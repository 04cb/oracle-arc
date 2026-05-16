"""One-shot orchestrator: fetch markets → analyze → write picks to disk.

Run with:  uv run python run.py [--limit N] [--out picks.json]
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from dataclasses import asdict
from pathlib import Path

from oracle import env  # noqa: F401  — must import first to load .env
from oracle.analyzer import analyze
from oracle.markets import fetch_open_binary_markets

log = logging.getLogger("oracle.run")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=8, help="markets to analyze")
    parser.add_argument(
        "--min-edge-bp",
        type=int,
        default=500,
        help="abs edge below this threshold = skipped pick",
    )
    parser.add_argument("--out", type=Path, default=Path("picks.json"))
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    log.info("fetching open markets…")
    markets = fetch_open_binary_markets(max_results=args.limit)
    log.info("got %d markets", len(markets))

    picks = []
    for m in markets:
        log.info("analyzing: %s  (vol=$%.0fk)", m.question[:80], m.volume / 1000)
        pick = analyze(m)
        if pick is None:
            log.info("  → skipped")
            continue
        if abs(pick.edge_bp) < args.min_edge_bp:
            log.info("  → edge %d bp below threshold, skipping", pick.edge_bp)
            continue
        log.info(
            "  → PICK %s @ p=%d bp (market=%d bp, edge=%d bp, kelly=%d bp)",
            pick.outcome_label,
            pick.my_probability_bp,
            pick.market_probability_bp,
            pick.edge_bp,
            pick.kelly_fraction_bp,
        )
        picks.append(pick)

    out = {"picks": [asdict(p) for p in picks]}
    args.out.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    log.info("wrote %d picks → %s", len(picks), args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
