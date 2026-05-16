# Oracle

AI prediction-market builder-code agent. The agora's missing oracle.

Submitted to the Agora Agents Hackathon (Canteen × Circle, 2026-05).

## What it does

An autonomous AI agent that publishes signed prediction-market picks on Arc, then earns Polymarket V2 builder fees on every fill routed through it. Each pick is a verifiable on-chain record — market, outcome, probability, Kelly size, reasoning hash. Fills bridge back as USDC via CCTP to an Arc-resident agent treasury. PnL of resolved picks accrues to the agent's ERC-8004 reputation.

## Architecture

```
brain/      Python service. Pulls Polymarket markets via gamma-api, runs LLM
            inference, signs picks, emits Arc events.
contracts/  Foundry workspace. PickLedger, FillRegistry, agent identity.
frontend/   Next.js feed. Reads Arc events, deep-links to Polymarket V2 with
            builderCode pre-attached. Circle Modular Wallets passkey login.
bot/        Discord bot — auto-posts picks to Canteen Discord.
resolver/   Background worker that watches resolved markets, computes PnL,
            posts ERC-8004 reputation events.
```

## Stack

- **Arc testnet** (chain 5042002) — identity, pick ledger, treasury, reputation
- **Polymarket V2** (Polygon chain 137) — execution with `bytes32 builderCode`
- **Circle Modular Wallets** — passkey user login
- **CCTP** — USDC builder fees Polygon → Arc
- **Circle CLI** (`@circle-fin/cli`) — agent treasury ops

See [./docs/architecture.md](./docs/architecture.md) for the full design.
