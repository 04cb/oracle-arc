# bridge/

Circle CCTPv2 bridging script. Moves USDC builder fees collected on Polymarket
(Polygon) into the Oracle agent treasury on Arc.

## Production path

```
Polymarket fills (Polygon mainnet)
  → builder fees accrue to our builder profile wallet
  → kit.bridge({ from: 'Polygon', to: 'Arc' })   ← when Arc mainnet ships
  → USDC arrives in agent treasury on Arc
```

## Hackathon demo path

Same SDK call, testnet identifiers:

```
Polygon Amoy Testnet  ─ CCTPv2 ─►  Arc Testnet
```

## Run

```bash
npm install
npm run plan     # estimate only
npm run bridge   # execute (needs USDC + native gas on Polygon Amoy)
```

`AGENT_PRIVATE_KEY` is read from the root `../.env`. The same EOA that
deployed PickLedger on Arc is used as the bridge sender — burned USDC on
Polygon Amoy is minted to the same address on Arc.

## Why this matters for judging

- **20% Circle tools score**: explicit, non-trivial use of CCTPv2 via the
  official `@circle-fin/bridge-kit` SDK.
- **Settlement on Arc story**: closes the loop. Picks live on Arc; fees
  earned on Polymarket flow back to Arc; reputation accrues on Arc. The
  whole agent surface area collapses onto Arc, with Polygon as the
  execution venue Polymarket happens to run on.
