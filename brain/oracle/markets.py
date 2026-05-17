"""Fetch Polymarket markets via the public gamma-api."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

import httpx

log = logging.getLogger(__name__)

GAMMA_API = "https://gamma-api.polymarket.com"


@dataclass
class Market:
    id: str
    slug: str
    question: str
    description: str
    condition_id: str
    outcomes: list[str]              # ["Yes", "No"]
    outcome_prices: list[float]      # [0.54, 0.46]
    outcome_token_ids: list[str]     # [tokenId_yes, tokenId_no]
    end_date: datetime | None
    liquidity: float
    volume: float
    enable_order_book: bool

    @classmethod
    def from_gamma(cls, raw: dict) -> "Market | None":
        try:
            outcomes = json.loads(raw.get("outcomes") or "[]")
            prices = [float(p) for p in json.loads(raw.get("outcomePrices") or "[]")]
            token_ids = json.loads(raw.get("clobTokenIds") or "[]")
            if not outcomes or not prices or len(outcomes) != len(prices):
                return None
            end_raw = raw.get("endDate")
            end = (
                datetime.fromisoformat(end_raw.replace("Z", "+00:00"))
                if end_raw
                else None
            )
            return cls(
                id=str(raw["id"]),
                slug=raw.get("slug", ""),
                question=raw.get("question", ""),
                description=raw.get("description", ""),
                condition_id=raw.get("conditionId", ""),
                outcomes=outcomes,
                outcome_prices=prices,
                outcome_token_ids=[str(t) for t in token_ids],
                end_date=end,
                liquidity=float(raw.get("liquidity") or 0),
                volume=float(raw.get("volume") or 0),
                enable_order_book=bool(raw.get("enableOrderBook")),
            )
        except (KeyError, ValueError, TypeError) as e:
            log.warning("skipping malformed market %s: %s", raw.get("id"), e)
            return None


def fetch_open_binary_markets(
    *,
    min_liquidity_usd: float = 5_000,
    min_volume_usd: float = 10_000,
    max_results: int = 50,
    skip: int = 0,
    client: httpx.Client | None = None,
) -> list[Market]:
    """Pull open binary (Yes/No) Polymarket markets with non-trivial liquidity.

    Returns markets sorted by recent volume descending. CLOB order books must
    be enabled (so users can actually place orders through our builder code).
    """
    own_client = client is None
    if own_client:
        client = httpx.Client(timeout=30.0)
    try:
        all_markets: list[Market] = []
        offset = 0
        page_size = 100
        while len(all_markets) < max(skip + max_results, max_results * 3) and offset < 2000:
            resp = client.get(
                f"{GAMMA_API}/markets",
                params={
                    "active": "true",
                    "closed": "false",
                    "archived": "false",
                    "limit": page_size,
                    "offset": offset,
                    "order": "volume",
                    "ascending": "false",
                },
            )
            resp.raise_for_status()
            page = resp.json()
            if not page:
                break
            for raw in page:
                m = Market.from_gamma(raw)
                if not m:
                    continue
                if not m.enable_order_book:
                    continue
                if len(m.outcomes) != 2:
                    continue
                if m.liquidity < min_liquidity_usd:
                    continue
                if m.volume < min_volume_usd:
                    continue
                if m.end_date and m.end_date < datetime.now(timezone.utc):
                    continue
                all_markets.append(m)
            offset += page_size
        return all_markets[skip : skip + max_results]
    finally:
        if own_client:
            client.close()


def render_for_llm(m: Market) -> str:
    """Compact text representation of a market for the LLM context."""
    yes_idx = next((i for i, o in enumerate(m.outcomes) if o.lower() == "yes"), 0)
    no_idx = 1 - yes_idx
    yes_price = m.outcome_prices[yes_idx]
    no_price = m.outcome_prices[no_idx]
    end = m.end_date.isoformat() if m.end_date else "unknown"
    desc = m.description.strip()
    if len(desc) > 1500:
        desc = desc[:1500] + "…"
    return (
        f"MARKET ID: {m.id} (conditionId={m.condition_id})\n"
        f"QUESTION: {m.question}\n"
        f"ENDS: {end}\n"
        f"LIQUIDITY: ${m.liquidity:,.0f}  VOLUME: ${m.volume:,.0f}\n"
        f"CURRENT PRICE: Yes={yes_price:.3f}  No={no_price:.3f}  "
        f"(implied P(Yes)={yes_price*100:.1f}%)\n"
        f"DESCRIPTION:\n{desc}"
    )
