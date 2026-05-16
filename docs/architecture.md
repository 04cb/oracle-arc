# Architecture

```
                  ┌─────────────────────────────────────────────────────┐
                  │                       BRAIN                          │
                  │                                                      │
                  │   gamma-api  →  DeepSeek-V4 Pro  →  Pick (sha256)    │
                  │  (markets)     (reasoning + Kelly)   (signed)        │
                  └────────────────────────┬────────────────────────────┘
                                           │ web3.py
                                           ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │                        ARC TESTNET (5042002)                      │
   │                                                                   │
   │   PickLedger.publish(marketId, side, probBP, edgeBP,             │
   │                       kellyFracBP, reasoningHash, URI)            │
   │   ─►  emits  Pick(agent, id, marketId, …, reasoningHash)         │
   │                                                                   │
   │   FillRegistry.attestFill(pickId, polymarketTradeId, fee)         │
   │   ─►  emits  FillAttribution(agent, pickId, tradeId, fee)        │
   │                                                                   │
   │   AgentTreasury  ◄─── USDC inflows from CCTPv2 mint               │
   └──────────────────────────────────────────────────────────────────┘
                                ▲                          ▲
                                │ viem.getLogs             │ CCTPv2 mint
                                │                          │
   ┌──────────────────────┐     │           ┌──────────────┴─────────┐
   │   FRONTEND (Next 16) │ ────┘           │   bridge/  (Bridge Kit) │
   │                       │                │                          │
   │   /            feed   │                │   approve → burn →       │
   │   /place/[id] order   │                │   attestation → mint     │
   │                       │                └──────────────┬──────────┘
   │   viem  + Polymarket │                                │
   │   clob-client-v2     │                                │ Polygon →
   │   (with builderCode)  │                                │ Arc
   └───────────┬───────────┘                                │
               │                                            │
               │  createAndPostOrder({ builderCode })       │
               ▼                                            │
   ┌──────────────────────────────────────────────────────┐ │
   │              POLYMARKET CLOB V2 (Polygon)             │ │
   │                                                       │ │
   │   user → signed order with `builder` = our bytes32    │ │
   │   → CTFExchangeV2.matchOrders                         │ │
   │   → OrderFilled (builder field on-chain)              │ │
   │   → builder fee accrues to builder profile wallet    │─┘
   └──────────────────────────────────────────────────────┘
               │
               │  getBuilderTrades() poll
               ▼
   ┌──────────────────────────────────────────────────────┐
   │   RESOLVER (background worker, planned)               │
   │   - watch resolved markets                            │
   │   - compute PnL per historical pick                   │
   │   - emit ERC-8004 reputation events on Arc            │
   └──────────────────────────────────────────────────────┘

                                 ║
                                 ▼
   ┌──────────────────────────────────────────────────────┐
   │   DISCORD WEBHOOK PUBLISHER                           │
   │   poll Arc → render embed → POST webhook              │
   └──────────────────────────────────────────────────────┘
```

## What lives where

| Component | Stack | Location |
|---|---|---|
| Brain (analyst) | Python 3.12, anthropic SDK → DeepSeek, web3.py, httpx | `brain/` |
| PickLedger contract | Solidity 0.8.27, Foundry | `contracts/src/PickLedger.sol` |
| Frontend feed + order placement | Next.js 16 (app router, Turbopack), viem, `@polymarket/clob-client-v2` | `frontend/` |
| CCTP bridge | Node 24, `@circle-fin/bridge-kit`, `@circle-fin/adapter-viem-v2` | `bridge/` |
| Discord publisher | Python, httpx; polls `eth_getLogs` | `brain/oracle/discord.py` |
| Reasoning store | local JSON files keyed by sha256; IPFS swap-in pending | `reasoning/` (gitignored) |

## Data flow per pick

1. **Brain selects a market.** Pulls open binary markets from Polymarket gamma-api, filters by liquidity > $5k, volume > $10k, order book enabled.
2. **Brain analyzes.** Renders the market into a prompt, sends to DeepSeek-V4 Pro (thinking enabled). Model returns `{ skip, outcome_choice, my_probability_bp, market_probability_bp, edge_bp, confidence, reasoning, evidence_points, sources_consulted }`.
3. **Pick is hashed.** sha256 of the canonical-JSON reasoning blob. Blob written to `reasoning/<hash>.json`. On-chain URI is `oracle://<hash>` for now; will become `ipfs://...` in production.
4. **Pick is published on Arc.** `PickLedger.publish(...)` emits a `Pick` event. The agent's secp256k1 signature is implicit in `tx.origin` matching the registered agent address.
5. **Discord publisher fires.** Within a minute of the on-chain emit, the publisher's cron-style script detects the new event, builds an embed, posts to the configured webhook URL. State file ensures no double-posting.
6. **User follows.** Visits the frontend, clicks `Place bet →` on a pick.
7. **Order is submitted with our builder code.** Frontend uses `@polymarket/clob-client-v2` client-side to: derive Polymarket L2 API creds (one signature), construct `UserOrderV2` with `builderCode = 0x1bf6...f217b9`, POST to `clob.polymarket.com`. Polymarket's relayer pays gas; our `builderCode` is part of the signed payload, immortalized on Polygon when the order fills.
8. **Fee flows back via CCTP.** A periodic worker calls `getBuilderTrades()`, sees new fills, triggers `kit.bridge({ from: Polygon, to: Arc, amount })` — USDC is burned on Polygon, attested by Circle, minted on Arc, lands in the agent treasury.
9. **Reputation accrues.** Eventually the Polymarket market resolves. A resolver service computes PnL per pick → emits ERC-8004 reputation events on Arc. The agent's track record becomes a queryable on-chain artifact.

## Why this architecture wins the hackathon

(judging weights: 30/30/20/20 = agent / traction / Circle / innovation)

- **Agent sophistication (30%)** — Every step is a real decision, not a rule. Brain picks markets, estimates probabilities, sizes positions, decides whether to publish. Reasoning traces are first-class artifacts, not by-products.
- **Traction (30%)** — Discord publisher posts every pick to a public channel; frontend gives a public URL to follow; orders attach our builder code so every fill is countable.
- **Circle tools (20%)** — Arc for the ledger + Agent Treasury; CCTPv2 via Bridge Kit to bring fees home; (planned) Modular Wallets for passkey login.
- **Innovation (20%)** — Combines Canteen's own research hooks #1 (Trading-R1 reasoning trace as the product) and #2 (Polymarket builder codes as agent monetization), plus ERC-8004 reputation tied to realized PnL — none of those individually is novel, but the stack is.
