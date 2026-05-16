"""Post new picks to a Discord channel via webhook.

A webhook URL is set on a single channel by a server admin in
    Channel Settings → Integrations → Webhooks → New Webhook
We just POST a JSON payload with embeds. No bot, no auth, no permissions
beyond what the webhook itself grants.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import httpx
from eth_account import Account
from web3 import Web3

from . import env
from .chain import PICK_LEDGER_ABI

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
STATE_FILE = REPO_ROOT / "discord_state.json"
REASONING_DIR = REPO_ROOT / "reasoning"

DEPLOY_BLOCK = 42_448_000  # block PickLedger was deployed; lower bound for log scan
GAMMA = "https://gamma-api.polymarket.com"
WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()


def _load_state() -> dict:
    if not STATE_FILE.exists():
        return {"last_block": DEPLOY_BLOCK - 1}
    return json.loads(STATE_FILE.read_text())


def _save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2))


def _ledger():
    w3 = Web3(Web3.HTTPProvider(env.ARC_RPC_URL))
    return w3, w3.eth.contract(
        address=Web3.to_checksum_address(env.PICK_LEDGER_ADDRESS),
        abi=PICK_LEDGER_ABI + [
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "name": "agent", "type": "address"},
                    {"indexed": True, "name": "id", "type": "uint256"},
                    {"indexed": True, "name": "marketId", "type": "bytes32"},
                    {"indexed": False, "name": "tokenId", "type": "uint256"},
                    {"indexed": False, "name": "side", "type": "uint8"},
                    {"indexed": False, "name": "probBP", "type": "uint16"},
                    {"indexed": False, "name": "edgeBP", "type": "int16"},
                    {"indexed": False, "name": "kellyFracBP", "type": "uint16"},
                    {"indexed": False, "name": "reasoningHash", "type": "bytes32"},
                    {"indexed": False, "name": "reasoningURI", "type": "string"},
                    {"indexed": False, "name": "expiresAt", "type": "uint64"},
                ],
                "name": "Pick",
                "type": "event",
            }
        ],
    )


def _agent_address() -> str:
    return Account.from_key(env.AGENT_PRIVATE_KEY).address


def _get_market_meta(condition_id: str) -> dict | None:
    try:
        r = httpx.get(
            f"{GAMMA}/markets",
            params={"condition_ids": condition_id, "limit": 1},
            timeout=15,
        )
        if r.status_code != 200:
            return None
        data = r.json()
        return data[0] if isinstance(data, list) and data else None
    except httpx.HTTPError:
        return None


def _load_reasoning(uri: str) -> dict | None:
    if not uri.startswith("oracle://"):
        return None
    h = uri.removeprefix("oracle://")
    fp = REASONING_DIR / f"{h}.json"
    if not fp.exists():
        return None
    return json.loads(fp.read_text())


def _build_embed(event_args: dict, log_data: dict) -> dict:
    """Render a Pick into a Discord embed."""
    condition_id = "0x" + event_args["marketId"].hex()
    meta = _get_market_meta(condition_id) or {}
    reasoning = _load_reasoning(event_args["reasoningURI"]) or {}

    edge_bp = event_args["edgeBP"]
    prob_bp = event_args["probBP"]
    market_bp = prob_bp - edge_bp
    side_label = reasoning.get("outcome_label") or ("Yes" if edge_bp >= 0 else "No")
    color = 0x10B981 if side_label.lower() == "yes" else 0xF43F5E

    question = meta.get("question") or "Unknown market"
    slug = meta.get("slug")
    polymarket_url = f"https://polymarket.com/event/{slug}" if slug else None
    arcscan_url = f"https://testnet.arcscan.app/tx/0x{log_data['transactionHash'].hex()}"

    description_lines = []
    if reasoning.get("reasoning"):
        description_lines.append(reasoning["reasoning"])
    if reasoning.get("evidence_points"):
        bullets = "\n".join(f"• {p}" for p in reasoning["evidence_points"][:4])
        description_lines.append(bullets)

    fields = [
        {"name": "Agent says", "value": f"{prob_bp/100:.1f}%", "inline": True},
        {"name": "Market says", "value": f"{market_bp/100:.1f}%", "inline": True},
        {
            "name": "Edge",
            "value": f"{'+' if edge_bp >= 0 else ''}{edge_bp/100:.1f}%",
            "inline": True,
        },
        {"name": "Kelly", "value": f"{event_args['kellyFracBP']/100:.1f}%", "inline": True},
        {
            "name": "Confidence",
            "value": (reasoning.get("confidence") or "—").upper(),
            "inline": True,
        },
        {
            "name": "On-chain",
            "value": f"[#{event_args['id']}]({arcscan_url})",
            "inline": True,
        },
    ]

    embed: dict = {
        "title": f"{side_label.upper()} — {question[:200]}",
        "description": "\n\n".join(description_lines)[:2000],
        "color": color,
        "fields": fields,
        "footer": {"text": "Oracle · published on Arc testnet"},
    }
    if polymarket_url:
        embed["url"] = polymarket_url
    return embed


def post_new_picks(*, dry_run: bool = False) -> int:
    """Scan Arc for Pick events newer than last_block; post each to Discord.

    Returns count of picks posted. Idempotent: state file ensures no
    double-posting.
    """
    if not WEBHOOK_URL and not dry_run:
        log.warning("DISCORD_WEBHOOK_URL not set; nothing to do")
        return 0

    state = _load_state()
    last_block = int(state.get("last_block", DEPLOY_BLOCK - 1))

    w3, ledger = _ledger()
    head = w3.eth.block_number
    if head <= last_block:
        log.info("no new blocks (head=%d last=%d)", head, last_block)
        return 0

    new_logs = ledger.events.Pick.get_logs(
        from_block=last_block + 1,
        to_block=head,
        argument_filters={"agent": _agent_address()},
    )
    log.info("found %d new picks in blocks %d..%d", len(new_logs), last_block + 1, head)

    posted = 0
    for entry in new_logs:
        embed = _build_embed(dict(entry["args"]), entry)
        payload = {"embeds": [embed]}
        if dry_run:
            print(json.dumps(payload, indent=2))
            posted += 1
            continue
        r = httpx.post(WEBHOOK_URL, json=payload, timeout=15)
        if r.status_code in (200, 204):
            posted += 1
            log.info("posted pick id=%s", entry["args"]["id"])
        else:
            log.error("webhook failed for pick id=%s: %s %s",
                      entry["args"]["id"], r.status_code, r.text[:200])
            # don't update state — retry next run
            return posted

    state["last_block"] = head
    if not dry_run:
        _save_state(state)
    return posted
