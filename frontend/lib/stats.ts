import { fetchPicks, publicClient, type PickEvent } from "./arc";

export type AgentStats = {
  picks: number;
  firstBlock: bigint | null;
  lastBlock: bigint | null;
  edgeSumAbs: number; // sum of |edgeBP|, in bp
  kellySumBP: number;
  yesPicks: number;
  noPicks: number;
  treasuryBalanceWei: bigint;
  agentAddress: `0x${string}` | null;
};

export async function getAgentStats(): Promise<{
  stats: AgentStats;
  events: PickEvent[];
}> {
  const events = await fetchPicks({ limit: 500 });
  const agentAddress =
    (events[0]?.agent as `0x${string}` | undefined) ?? null;

  let edgeSumAbs = 0;
  let kellySumBP = 0;
  let yes = 0;
  let no = 0;
  for (const e of events) {
    edgeSumAbs += Math.abs(e.edgeBP);
    kellySumBP += e.kellyFracBP;
    if (e.edgeBP >= 0) yes++;
    else no++;
  }

  let balance = 0n;
  if (agentAddress) {
    try {
      balance = await publicClient.getBalance({ address: agentAddress });
    } catch {
      // ignore — RPC might rate-limit
    }
  }

  const sorted = [...events].sort((a, b) =>
    a.blockNumber - b.blockNumber > 0n ? 1 : -1,
  );

  return {
    events,
    stats: {
      picks: events.length,
      firstBlock: sorted[0]?.blockNumber ?? null,
      lastBlock: sorted[sorted.length - 1]?.blockNumber ?? null,
      edgeSumAbs,
      kellySumBP,
      yesPicks: yes,
      noPicks: no,
      treasuryBalanceWei: balance,
      agentAddress,
    },
  };
}

export function fmtUSDC(wei: bigint): string {
  // Arc native gas is USDC, 18 decimals
  const whole = Number(wei) / 1e18;
  return whole.toFixed(2);
}
