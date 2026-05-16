"""Pick — the structured output of the agent's analysis."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone


@dataclass
class Pick:
    """A single AI-generated prediction-market recommendation.

    All probability/edge/kelly values are in basis points (0..10000) to match
    the on-chain ABI. Negative edge means we recommend SHORTING the outcome,
    which on Polymarket = buying the opposite outcome token.
    """

    # --- market identity ---
    market_id: str            # Polymarket conditionId (0x… bytes32 hex)
    market_slug: str          # human-readable slug
    market_question: str
    outcome_token_id: str     # specific outcome token (uint256 as string)
    outcome_label: str        # "Yes" | "No" (for human display)

    # --- agent decision ---
    side: int                 # 0 = BUY this token, 1 = SELL it short
    my_probability_bp: int    # agent's estimate of P(this token resolves to 1)
    market_probability_bp: int  # current implied probability
    edge_bp: int              # signed edge over market
    confidence: str           # "high" | "medium" | "low"
    kelly_fraction_bp: int    # recommended fraction of bankroll
    reasoning: str            # 2-4 sentence summary
    evidence_points: list[str] = field(default_factory=list)
    sources_consulted: list[str] = field(default_factory=list)

    # --- metadata ---
    expires_at: int = 0       # unix timestamp; pick is invalid after this
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    agent_version: str = "0.1.0"

    def reasoning_blob(self) -> dict:
        """Full blob that gets hashed + pinned (IPFS/HTTPS later)."""
        return {
            "market_id": self.market_id,
            "market_slug": self.market_slug,
            "market_question": self.market_question,
            "outcome_label": self.outcome_label,
            "side": self.side,
            "my_probability_bp": self.my_probability_bp,
            "market_probability_bp": self.market_probability_bp,
            "edge_bp": self.edge_bp,
            "confidence": self.confidence,
            "kelly_fraction_bp": self.kelly_fraction_bp,
            "reasoning": self.reasoning,
            "evidence_points": self.evidence_points,
            "sources_consulted": self.sources_consulted,
            "created_at": self.created_at,
            "agent_version": self.agent_version,
        }

    def reasoning_hash(self) -> bytes:
        """sha256 of the canonical-JSON reasoning blob (32 bytes)."""
        canonical = json.dumps(
            self.reasoning_blob(), sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
        return hashlib.sha256(canonical).digest()

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, ensure_ascii=False)


def kelly_fraction_bp(p_win: float, b: float = 1.0, cap_bp: int = 2500) -> int:
    """Kelly criterion for a binary bet. p_win is win probability (0..1), b is
    the net odds (1.0 means 1:1 payout). Returns capped fraction in basis points.

    Polymarket pricing makes b = (1 - price) / price for a YES bet at `price`.
    We cap at 25% to avoid overconfidence destroying the bankroll.
    """
    if p_win <= 0 or p_win >= 1:
        return 0
    q = 1 - p_win
    f = (b * p_win - q) / b if b > 0 else 0
    if f <= 0:
        return 0
    bp = int(round(f * 10000))
    return min(bp, cap_bp)
