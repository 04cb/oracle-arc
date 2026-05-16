/**
 * Bridge builder fees from Polygon (testnet) into the Oracle agent treasury
 * on Arc using Circle CCTPv2 via @circle-fin/bridge-kit.
 *
 * Production path: Polygon mainnet → Arc mainnet (once Arc is live).
 * Hackathon demo: Polygon_Amoy_Testnet → Arc_Testnet — same SDK call, same
 * agent address, just testnet identifiers.
 *
 * Usage:
 *   npm run plan    # estimate only, no on-chain action
 *   npm run bridge  # execute: approve + burn + attest + mint
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { BridgeKit } from '@circle-fin/bridge-kit';
import { createViemAdapterFromPrivateKey } from '@circle-fin/adapter-viem-v2';

// Load the project's root .env (shared with brain + frontend).
const envPath = resolve(import.meta.dirname, '..', '.env');
const envText = readFileSync(envPath, 'utf-8');
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
if (!PRIVATE_KEY) {
  console.error('AGENT_PRIVATE_KEY not set in .env');
  process.exit(1);
}

const FROM_CHAIN = 'Polygon_Amoy_Testnet' as const;
const TO_CHAIN = 'Arc_Testnet' as const;
const AMOUNT = process.env.BRIDGE_AMOUNT_USDC ?? '0.5';

const planOnly = process.argv.includes('--plan-only');

async function main() {
  const adapter = createViemAdapterFromPrivateKey({ privateKey: PRIVATE_KEY! });
  const kit = new BridgeKit();

  console.log('Bridge plan');
  console.log('  from:    ', FROM_CHAIN);
  console.log('  to:      ', TO_CHAIN);
  console.log('  amount:  ', AMOUNT, 'USDC');
  console.log('  signer:  ', process.env.AGENT_ADDRESS ?? '(derived)');
  console.log();

  if (planOnly) {
    // estimate() is supported in the kit; surfaces gas + protocol fees
    // without signing. If unavailable on this version, fall back to a
    // human-readable dry-run note.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyKit = kit as any;
    if (typeof anyKit.estimate === 'function') {
      try {
        const est = await anyKit.estimate({
          from: { adapter, chain: FROM_CHAIN },
          to: { adapter, chain: TO_CHAIN },
          amount: AMOUNT,
        });
        console.log('Estimate:');
        console.log(toJSON(est));
        return;
      } catch (e) {
        console.warn('estimate() unavailable or errored:', (e as Error).message);
      }
    }
    console.log('Dry run only — pass `npm run bridge` to actually execute.');
    return;
  }

  console.log('Executing CCTP bridge…');
  const result = await kit.bridge({
    from: { adapter, chain: FROM_CHAIN },
    to: { adapter, chain: TO_CHAIN },
    amount: AMOUNT,
  });

  console.log('Result:');
  console.log(toJSON(result));
}

function toJSON(value: unknown): string {
  return JSON.stringify(
    value,
    (_, v) => (typeof v === 'bigint' ? v.toString() : v),
    2,
  );
}

main().catch((e) => {
  console.error('Bridge failed:', e);
  process.exit(1);
});
