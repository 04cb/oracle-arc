# Oracle

> An autonomous AI agent that publishes signed prediction-market picks on Arc,
> earns Polymarket V2 builder fees on every fill routed through it, and bridges
> those USDC fees home via CCTPv2.

Built for the **Agora Agents Hackathon** (Canteen × Circle, 2026-05-11 → 2026-05-25).

**Live demo: https://oracle-arc.vercel.app**

![Oracle home page](./docs/screenshots/home.png)

---

## What it does in three sentences

1. A Python brain (DeepSeek-V4 Pro with reasoning) reads open Polymarket markets, picks the mispriced ones, and emits a signed `Pick` event on Arc — market + recommended side + agent probability + Kelly size + sha256 of the reasoning trace.
2. A Next.js frontend reads those events live, renders each pick with the agent's reasoning, and lets a visitor place an order on Polymarket V2 with **our builder code** attached to the signed order struct.
3. When a Polymarket order fills, builder fees accrue on Polygon. A CCTPv2 bridge (Circle Bridge Kit) moves them to the agent's treasury on Arc, where the whole reputation loop closes.

## Live artifacts

- **PickLedger contract:** [`0x762cc26e9CE5A7D3FcCB3C09d3f2d54c25EaBC2b`](https://testnet.arcscan.app/address/0x762cc26e9CE5A7D3FcCB3C09d3f2d54c25EaBC2b) on Arc Testnet
- **ReputationRegistry contract:** [`0x1F4C93d8a8005601b2E89d163Ffe7992344f5DA6`](https://testnet.arcscan.app/address/0x1F4C93d8a8005601b2E89d163Ffe7992344f5DA6)
- **Agent address:** [`0x48188D27d765559C89ed0969157F8d463b64B14e`](https://testnet.arcscan.app/address/0x48188D27d765559C89ed0969157F8d463b64B14e)
- **Polymarket builder code:** `0x1bf684d4371715597038e7f7a28ca992bb9cf226ec8c66182db09e143fa217b9`
- **Polymarket builder address:** `0x5447bb168ae8d63ac222beb411ee148f5b649383`
- **Frontend:** `npm run dev` in `frontend/` (see [docs/deploy.md](./docs/deploy.md) for Vercel)
- **Demo script:** [docs/demo-script.md](./docs/demo-script.md)
- **Architecture:** [docs/architecture.md](./docs/architecture.md)

## Repo layout

```
brain/        Python brain. Pull markets, run LLM, sign & publish picks,
              cron Discord webhook.
contracts/    Foundry workspace. PickLedger.sol + ReputationRegistry.sol
              (7 forge tests, all pass).
frontend/     Next.js 16. Live picks feed (/), order placement (/place/[id]),
              agent profile + track record (/agent/[address]), Circle
              Modular Wallets passkey login (/wallet).
bridge/       Node + tsx. CCTPv2 bridge script (Polygon → Arc) using
              Circle Bridge Kit.
docs/         Architecture diagram, demo script, deploy guide, screenshots.
```

See [`docs/architecture.md`](./docs/architecture.md) for the full system diagram and per-pick data flow.

## Run it locally

### Prereqs

- Python 3.12+ with `uv`
- Node 20+ (24 LTS recommended), `npm`
- Foundry (forge, cast)
- A funded EOA on Arc Testnet (use [Circle's faucet](https://faucet.circle.com/))
- API key for an Anthropic-compatible LLM endpoint (DeepSeek or Anthropic)

### Setup

```bash
cp .env.example .env
chmod 600 .env
# edit .env with: ANTHROPIC_*, ARC_RPC_URL (from `arc-canteen rpc-url`),
# AGENT_PRIVATE_KEY, POLYMARKET_BUILDER_CODE
```

### Deploy PickLedger (if you don't want to use ours)

```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge test                  # 4/4 pass
forge script script/DeployPickLedger.s.sol --rpc-url "$ARC_RPC_URL" --broadcast --legacy
# copy the deployed address into PICK_LEDGER_ADDRESS in .env
# and NEXT_PUBLIC_PICK_LEDGER_ADDRESS in frontend/.env.local
```

### Run the brain

```bash
cd brain
uv run python run.py --limit 8 --publish     # generate + publish picks
```

### Run the frontend

```bash
cd frontend
npm install
npm run dev                                  # http://localhost:3000
```

### Bridge demo (Circle CCTPv2)

```bash
cd bridge
npm install
npm run plan         # estimate the bridge; no signing
npm run bridge       # execute (needs POL + USDC on Polygon Amoy)
```

### Discord publisher

Get a webhook URL from a Discord channel (Channel Settings → Integrations → Webhooks → New Webhook). Add it to `.env`:

```bash
export DISCORD_WEBHOOK_URL='https://discord.com/api/webhooks/...'
cd brain
uv run python publish_discord.py --dry-run   # preview embeds
uv run python publish_discord.py             # post all unseen picks
```

Schedule via cron (every 5 minutes):

```cron
*/5 * * * * cd /path/to/arc/brain && uv run python publish_discord.py >> /tmp/oracle-discord.log 2>&1
```

## Hackathon scoring map

| Dimension (weight) | How Oracle scores |
|---|---|
| Agentic Sophistication (30%) | Full pipeline: market selection → LLM probability estimate → Kelly sizing → publish decision. Reasoning traces are first-class artifacts, not log lines. |
| Traction (30%) | Discord publisher pushes every pick to a public channel. Frontend gives a public URL with one-click order placement. Builder code makes every fill attributable. Share buttons let visitors broadcast picks. |
| Circle tools (20%) | **Arc Testnet** for the ledger; **CCTPv2 via Bridge Kit** for fee flow (estimate verified end-to-end); **Smart Contract Platform** (forge-deployed `PickLedger` + `ReputationRegistry`); **Modular Wallets** passkey login at `/wallet`; agent treasury holds **USDC** as native gas. |
| Innovation (20%) | First implementation of Canteen's own research hooks #1 (Trading-R1 reasoning trace as the product) and #2 (Polymarket builder codes as agent monetization), bound together by ERC-8004-style reputation events on Arc. |

## Screenshots

| Home — picks feed + how-it-works | Agent profile — track record |
|---|---|
| ![home](./docs/screenshots/home.png) | ![agent](./docs/screenshots/agent.png) |
| **Place bet — builder code attribution** | **Passkey wallet — Circle Modular Wallets** |
| ![place](./docs/screenshots/place.png) | ![wallet](./docs/screenshots/wallet.png) |

## Acknowledgements

- **Canteen** — for the agora research section that telegraphed half of this design.
- **Circle** — for actually shipping `@circle-fin/bridge-kit` so this bridge worked first try.
- **DeepSeek** — for Anthropic-protocol compatibility that let us swap models without rewriting the brain.

## License

MIT.
