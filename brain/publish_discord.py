"""Run the Discord publisher once. Suitable for cron / supervisor.

Usage:
  uv run python publish_discord.py            # post all unseen picks
  uv run python publish_discord.py --dry-run  # print embed payload, don't post
"""

from __future__ import annotations

import argparse
import logging
import sys

from oracle import env  # noqa: F401  — must import first to load .env
from oracle.discord import post_new_picks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    posted = post_new_picks(dry_run=args.dry_run)
    print(f"posted {posted} pick(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
