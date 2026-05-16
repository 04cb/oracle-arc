"""Publish a Pick to the PickLedger contract on Arc.

Reasoning blob is written to local disk (under `reasoning/<hash>.json`) and
the on-chain `reasoningURI` field points to a path the frontend will serve
later. For an MVP this is enough; IPFS / Arweave pinning is a D7+ upgrade.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import Web3

from . import env
from .pick import Pick

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
REASONING_DIR = REPO_ROOT / "reasoning"
REASONING_DIR.mkdir(exist_ok=True)


PICK_LEDGER_ABI = [
    {
        "inputs": [{"internalType": "string", "name": "name", "type": "string"}],
        "name": "register",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "registered",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "nextId",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "marketId", "type": "bytes32"},
            {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
            {"internalType": "uint8", "name": "side", "type": "uint8"},
            {"internalType": "uint16", "name": "probBP", "type": "uint16"},
            {"internalType": "int16", "name": "edgeBP", "type": "int16"},
            {"internalType": "uint16", "name": "kellyFracBP", "type": "uint16"},
            {"internalType": "bytes32", "name": "reasoningHash", "type": "bytes32"},
            {"internalType": "string", "name": "reasoningURI", "type": "string"},
            {"internalType": "uint64", "name": "expiresAt", "type": "uint64"},
        ],
        "name": "publish",
        "outputs": [{"internalType": "uint256", "name": "id", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


def _agent_account() -> LocalAccount:
    if not env.AGENT_PRIVATE_KEY:
        raise RuntimeError("AGENT_PRIVATE_KEY not set")
    return Account.from_key(env.AGENT_PRIVATE_KEY)


def _w3() -> Web3:
    if not env.ARC_RPC_URL:
        raise RuntimeError("ARC_RPC_URL not set")
    w3 = Web3(Web3.HTTPProvider(env.ARC_RPC_URL))
    if not w3.is_connected():
        raise RuntimeError("Web3 cannot connect to Arc RPC")
    return w3


def _ledger(w3: Web3):
    if not env.PICK_LEDGER_ADDRESS:
        raise RuntimeError("PICK_LEDGER_ADDRESS not set")
    return w3.eth.contract(
        address=Web3.to_checksum_address(env.PICK_LEDGER_ADDRESS),
        abi=PICK_LEDGER_ABI,
    )


def _save_reasoning(pick: Pick) -> tuple[bytes, str]:
    """Write reasoning blob to disk; return (hash bytes32, URI string)."""
    h = pick.reasoning_hash()
    fname = REASONING_DIR / f"{h.hex()}.json"
    fname.write_text(json.dumps(pick.reasoning_blob(), indent=2, ensure_ascii=False))
    uri = f"oracle://{h.hex()}"  # frontend resolves these to /reasoning/<hash>.json
    return h, uri


def publish(pick: Pick) -> tuple[int, str]:
    """Publish a Pick on-chain. Returns (pickId, txHash)."""
    w3 = _w3()
    acct = _agent_account()
    ledger = _ledger(w3)

    h, uri = _save_reasoning(pick)

    market_id_bytes = bytes.fromhex(pick.market_id.removeprefix("0x"))
    if len(market_id_bytes) != 32:
        raise ValueError(
            f"market_id is {len(market_id_bytes)} bytes, expected 32: {pick.market_id}"
        )
    token_id_int = int(pick.outcome_token_id)
    expires = pick.expires_at or (int(__import__("time").time()) + 14 * 86400)

    tx = ledger.functions.publish(
        market_id_bytes,
        token_id_int,
        pick.side,
        pick.my_probability_bp,
        pick.edge_bp,
        pick.kelly_fraction_bp,
        h,
        uri,
        expires,
    ).build_transaction(
        {
            "from": acct.address,
            "nonce": w3.eth.get_transaction_count(acct.address),
            "gas": 250_000,
            "gasPrice": w3.eth.gas_price,
            "chainId": env.ARC_CHAIN_ID,
        }
    )
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt.status != 1:
        raise RuntimeError(f"publish reverted, tx {tx_hash.hex()}")

    # Find the Pick event in the logs to extract the pickId
    pick_id = _extract_pick_id(receipt)
    return pick_id, tx_hash.hex()


def _extract_pick_id(receipt) -> int:
    # Pick(address indexed agent, uint256 indexed id, bytes32 indexed marketId, …)
    # Topic 0 = event sig; Topic 1 = agent; Topic 2 = id; Topic 3 = marketId
    # We need the keccak256 of the event signature to identify it; easier:
    # the first log from our contract is ours since publish() only emits Pick.
    for log_ in receipt.logs:
        if len(log_["topics"]) >= 3:
            return int.from_bytes(log_["topics"][2], "big")
    return -1


def ensure_registered(name: str = "Oracle") -> None:
    """No-op if the agent is already registered."""
    w3 = _w3()
    acct = _agent_account()
    ledger = _ledger(w3)
    if ledger.functions.registered(acct.address).call():
        return
    log.info("registering agent %s as %r on ledger…", acct.address, name)
    tx = ledger.functions.register(name).build_transaction(
        {
            "from": acct.address,
            "nonce": w3.eth.get_transaction_count(acct.address),
            "gas": 80_000,
            "gasPrice": w3.eth.gas_price,
            "chainId": env.ARC_CHAIN_ID,
        }
    )
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt.status != 1:
        raise RuntimeError(f"register reverted, tx {tx_hash.hex()}")
    log.info("registered, tx %s", tx_hash.hex())
