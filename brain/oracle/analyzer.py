"""Run an LLM over a market and produce a structured Pick.

The LLM is asked to:
  1. read the market question + description
  2. estimate the true probability of the YES outcome
  3. compare to market's implied probability and compute edge
  4. decide whether to recommend a position (and which side + size)
  5. produce a short reasoning trace + evidence bullet points

Output is constrained to JSON. We treat anything off-schema as "skip".
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from anthropic import Anthropic
from anthropic.types import Message

from . import env
from .markets import Market, render_for_llm
from .pick import Pick, kelly_fraction_bp

log = logging.getLogger(__name__)

_client: Anthropic | None = None


def get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(
            base_url=env.ANTHROPIC_BASE_URL,
            api_key=env.ANTHROPIC_AUTH_TOKEN,
        )
    return _client


PROMPT_SYSTEM = """You are Oracle — an AI prediction-market analyst.

For each market:
1. Read the question and resolution rules.
2. Estimate the TRUE probability that YES resolves (call this p_yes_true, 0..1).
3. The market shows implied_p_yes from the price.
4. If |p_yes_true - implied_p_yes| < 0.05, set "skip": true.
5. Otherwise pick the cheaper side:
   - If p_yes_true > implied_p_yes → outcome_choice = "Yes" (market underprices YES).
   - If p_yes_true < implied_p_yes → outcome_choice = "No"  (market overprices YES).
6. Report numbers RELATIVE TO YES — do NOT flip them when the choice is No:
   - my_probability_bp     = round(p_yes_true * 10000)
   - market_probability_bp = round(implied_p_yes * 10000)
   - edge_bp               = my_probability_bp - market_probability_bp
     (negative edge_bp means you're recommending No)
7. Output ONE JSON object, no prose around it.

Be honest. If reasoning is weak, set "skip": true — every published pick
attaches to the agent's on-chain reputation, and a wrong pick is much
costlier than a missed one.
"""

OUTPUT_SCHEMA_HINT = """{
  "skip": false,
  "outcome_choice": "Yes" | "No",
  "my_probability_bp": 0..10000,           // your P(YES) * 10000
  "market_probability_bp": 0..10000,       // implied P(YES) from the market * 10000
  "edge_bp": int,                          // = my - market; sign tells the side
  "confidence": "high" | "medium" | "low",
  "reasoning": "<2-4 sentence justification>",
  "evidence_points": ["bullet 1", "bullet 2", "bullet 3"],
  "sources_consulted": ["..."]
}"""


def analyze(market: Market) -> Pick | None:
    """Run the LLM over a market and return a Pick, or None to skip."""
    user_msg = (
        f"{render_for_llm(market)}\n\n"
        "Respond with ONE JSON object matching this schema (NO prose, NO markdown fences):\n"
        f"{OUTPUT_SCHEMA_HINT}"
    )
    try:
        resp: Message = get_client().messages.create(
            model=env.ANTHROPIC_MODEL,
            max_tokens=4000,
            system=PROMPT_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
    except Exception as e:
        log.warning("LLM call failed for market %s: %s", market.id, e)
        return None

    text = _extract_text(resp)
    if not text:
        # Fallback: try to find JSON inside any thinking block
        for block in resp.content:
            if getattr(block, "type", None) == "thinking":
                text = block.thinking
                break
    parsed = _parse_json(text)
    if parsed is None:
        log.warning(
            "LLM returned non-JSON for market %s (stop=%s, tokens=%s): %r",
            market.id, resp.stop_reason, resp.usage.output_tokens, text[:200],
        )
        return None

    if parsed.get("skip"):
        return None

    return _build_pick(market, parsed)


def _extract_text(resp: Message) -> str:
    for block in resp.content:
        if getattr(block, "type", None) == "text":
            return block.text
    return ""


_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _parse_json(text: str) -> dict[str, Any] | None:
    text = text.strip()
    # strip optional markdown fence
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = _JSON_RE.search(text)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def _build_pick(market: Market, p: dict[str, Any]) -> Pick | None:
    try:
        outcome_label = str(p["outcome_choice"]).strip()
        my_prob = int(p["my_probability_bp"])
        mkt_prob = int(p["market_probability_bp"])
        edge = int(p["edge_bp"])
        confidence = str(p.get("confidence", "low")).lower()
        reasoning = str(p["reasoning"]).strip()
        evidence = [str(x) for x in p.get("evidence_points", [])][:8]
        sources = [str(x) for x in p.get("sources_consulted", [])][:8]
    except (KeyError, ValueError, TypeError):
        return None

    if not (0 <= my_prob <= 10000 and 0 <= mkt_prob <= 10000):
        return None

    # Sanity check: sign of edge must match chosen side.
    # edge_bp > 0  → YES is underpriced → choice should be "Yes"
    # edge_bp < 0  → YES is overpriced  → choice should be "No"
    derived_side = "Yes" if (my_prob - mkt_prob) > 0 else "No"
    if outcome_label.lower() != derived_side.lower():
        log.warning(
            "market %s: outcome_choice=%s contradicts edge (my=%d mkt=%d); overriding to %s",
            market.id, outcome_label, my_prob, mkt_prob, derived_side,
        )
        outcome_label = derived_side

    # Map outcome_label to outcome token id
    idx = next(
        (i for i, o in enumerate(market.outcomes) if o.lower() == outcome_label.lower()),
        None,
    )
    if idx is None or idx >= len(market.outcome_token_ids):
        return None

    side = 0  # always BUY the chosen outcome; the choice itself encodes direction
    chosen_price = market.outcome_prices[idx]
    if chosen_price <= 0 or chosen_price >= 1:
        return None

    # Kelly: agent's belief that the *chosen outcome* wins
    if outcome_label.lower() == "yes":
        p_win = my_prob / 10000.0
    else:
        p_win = 1.0 - (my_prob / 10000.0)
    b = (1.0 - chosen_price) / chosen_price
    kelly_bp = kelly_fraction_bp(p_win, b)

    return Pick(
        market_id=market.condition_id,
        market_slug=market.slug,
        market_question=market.question,
        outcome_token_id=market.outcome_token_ids[idx],
        outcome_label=outcome_label,
        side=side,
        my_probability_bp=my_prob,
        market_probability_bp=mkt_prob,
        edge_bp=edge,
        confidence=confidence,
        kelly_fraction_bp=kelly_bp,
        reasoning=reasoning,
        evidence_points=evidence,
        sources_consulted=sources,
        expires_at=int(market.end_date.timestamp()) if market.end_date else 0,
    )
