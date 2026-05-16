# Demo video script — Oracle (~3 min)

Target: judges of Agora Agents Hackathon. Goal: convey the full thesis +
demonstrate that it actually works on-chain, in under 180 seconds.

---

## [0:00 – 0:15]  Opening — the thesis

> **VOICEOVER**
> "Polymarket has a price for everything. But every signal feed today
> recommends bets and earns nothing — the user trades somewhere else.
> Polymarket V2 just shipped builder codes. We built the agent that
> uses them."

[VISUAL] — title card `Oracle.`, "AI prediction-market agent" subtitle,
agora hackathon badge.

## [0:15 – 0:35]  The agent

> "The brain reads open Polymarket markets, runs DeepSeek-V4 Pro with
> reasoning enabled, and emits a signed pick on Arc — market, side,
> probability, Kelly size, and a sha-256 of the full reasoning trace.
> Every recommendation is on-chain forever."

[VISUAL] — terminal: `uv run python run.py --limit 8 --publish`
streaming logs of one pick analysis → resulting `Pick` event on
arcscan.

## [0:35 – 1:00]  The frontend

> "Here is the live feed. Eight picks signed by our agent EOA on Arc,
> ranging from a NO on the US acquiring Greenland in 2026 to a YES on
> Abstract's FDV above $200M one day post-launch. Each card shows
> agent vs market probability, edge, Kelly fraction, and the full
> reasoning trace, hash-anchored to a `Pick` event."

[VISUAL] — scroll through home page, hover the Greenland card, click
the on-chain id to open arcscan in a new tab.

## [1:00 – 1:25]  The builder code attribution

> "Click *Place bet* on any pick. We use the official
> `@polymarket/clob-client-v2` SDK to construct a V2 order with our
> bytes32 builder code attached directly to the signed order struct —
> no URL params, no off-chain attribution. Polymarket's relayer pays
> the gas; we get the builder fee on every fill."

[VISUAL] — open /place/4 (Abstract YES, 25% Kelly). Show the
"Connect wallet → derive API creds → place order" three-step flow.
The builder code is shown in the form footer: `0x1bf6…f217b9`.

## [1:25 – 1:50]  The settlement loop on Arc

> "When orders fill, builder fees accrue on Polygon. We pipe them home
> via Circle's CCTPv2 SDK — burn USDC on Polygon, attestation, mint on
> Arc. Same agent address, same EOA, both chains. The agent's whole
> economic surface lives on Arc."

[VISUAL] — `cd bridge && npm run plan` showing the live estimate
output: approve + burn on Polygon Amoy, mint on Arc Testnet, ~$0.03
total cost for a 0.5 USDC bridge.

## [1:50 – 2:15]  Reputation on Arc

> "When a market resolves, the resolver computes realized PnL and
> writes a Reputation event on Arc. Track record is queryable, not a
> claim. Our agent profile page shows every pick, every edge, every
> on-chain transaction — no off-chain dashboard, no off-chain trust."

[VISUAL] — open /agent/0x4818...b14e. Highlight the 5-stat row and the
track-record table.

## [2:15 – 2:45]  Why this wins the hackathon

> "Four scoring dimensions: thirty / thirty / twenty / twenty.
>
> Agentic sophistication: the brain makes every real decision — which
> market, which side, what size, whether to publish at all.
>
> Traction: the Discord publisher posts every pick to a public
> channel; the frontend gives one-click order placement with
> attribution.
>
> Circle tools: Arc for the ledger, CCTPv2 for fee flow, ERC-8004-style
> reputation events for track record.
>
> Innovation: this is the first implementation of Canteen's own
> research hooks — Trading-R1 reasoning trace as the product, plus
> Polymarket builder codes as the agent's monetization layer — bound
> together by on-chain reputation."

[VISUAL] — split-screen: home page on the left, scrolling architecture
diagram from docs/architecture.md on the right.

## [2:45 – 3:00]  Closing

> "Oracle. Builder code on Polymarket, picks on Arc, fees home via
> CCTP. The agora's missing oracle."

[VISUAL] — title card, GitHub URL, frontend URL.

---

## Recording notes

- Record at 1440p, screen capture only — no webcam.
- Voiceover separately, then sync. Don't read scripts live; the cadence
  matters.
- Use the dev server at http://localhost:3737 for visuals; verify the
  picks count matches narration before each take.
- For the Polymarket SDK section, screenshot the order construction
  rather than going live (avoid leaking your Polymarket session).
- Export at 1080p H.264 for the submission form.
