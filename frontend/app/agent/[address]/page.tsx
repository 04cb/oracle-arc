import Link from "next/link";
import { notFound } from "next/navigation";
import { isAddress } from "viem";

import { fetchPicks, PICK_LEDGER_ADDRESS } from "@/lib/arc";
import { getMarketMeta } from "@/lib/polymarket";
import { fetchReasoning } from "@/lib/reasoning";
import { fmtUSDC, getAgentStats } from "@/lib/stats";

export const revalidate = 60;

type Params = Promise<{ address: string }>;

function bp(n: number): string {
  return `${(n / 100).toFixed(1)}%`;
}

export default async function AgentPage({ params }: { params: Params }) {
  const { address } = await params;
  if (!isAddress(address)) notFound();

  const events = await fetchPicks({
    agent: address as `0x${string}`,
    limit: 500,
  });
  if (events.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← back to feed
          </Link>
          <h1 className="text-2xl font-serif mt-4">
            No picks for this agent yet.
          </h1>
          <p className="text-sm text-zinc-500 mt-2 font-mono">{address}</p>
        </div>
      </main>
    );
  }

  // Reuse the global stats helper — it queries by latest events, but for the
  // agent-specific view we re-derive from `events` here:
  const { stats: globalStats } = await getAgentStats();
  const balance =
    address.toLowerCase() === globalStats.agentAddress?.toLowerCase()
      ? globalStats.treasuryBalanceWei
      : 0n;

  const yesPicks = events.filter((e) => e.edgeBP >= 0).length;
  const noPicks = events.length - yesPicks;
  const edgeSumAbs = events.reduce((s, e) => s + Math.abs(e.edgeBP), 0);
  const avgEdgeBP = edgeSumAbs / events.length;
  const avgKellyBP =
    events.reduce((s, e) => s + e.kellyFracBP, 0) / events.length;

  // Enrich each pick with market metadata + reasoning (parallel)
  const rows = await Promise.all(
    events.map(async (e) => {
      const [m, r] = await Promise.all([
        getMarketMeta(e.marketId),
        fetchReasoning(e.reasoningURI),
      ]);
      return { e, m, r };
    }),
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← back to feed
        </Link>

        <header className="mt-4 border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-amber-300 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
            agent profile
          </div>
          <h1 className="text-3xl font-serif tracking-tight">Oracle</h1>
          <p className="text-xs text-zinc-500 mt-2 font-mono">
            <a
              className="underline hover:text-zinc-300"
              href={`https://testnet.arcscan.app/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {address}
            </a>
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Picks emitted via{" "}
            <a
              className="underline hover:text-zinc-300"
              href={`https://testnet.arcscan.app/address/${PICK_LEDGER_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              PickLedger
            </a>
            .
          </p>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          <StatCard label="picks signed" value={events.length.toString()} />
          <StatCard label="yes / no" value={`${yesPicks} / ${noPicks}`} />
          <StatCard label="avg edge" value={bp(avgEdgeBP)} />
          <StatCard label="avg kelly" value={bp(avgKellyBP)} />
          <StatCard label="treasury" value={`${fmtUSDC(balance)} USDC`} />
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3 border-b border-zinc-800 pb-2">
            full track record
          </h2>

          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-xs text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">id</th>
                  <th className="px-3 py-2 text-left">market</th>
                  <th className="px-3 py-2 text-center">side</th>
                  <th className="px-3 py-2 text-right">agent</th>
                  <th className="px-3 py-2 text-right">market</th>
                  <th className="px-3 py-2 text-right">edge</th>
                  <th className="px-3 py-2 text-right">kelly</th>
                  <th className="px-3 py-2 text-right">tx</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ e, m, r }) => {
                  const outcome =
                    r?.outcome_label ?? (e.edgeBP >= 0 ? "Yes" : "No");
                  const isYes = outcome.toLowerCase() === "yes";
                  return (
                    <tr
                      key={e.txHash}
                      className="border-t border-zinc-800 hover:bg-zinc-900/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                        #{e.pickId.toString()}
                      </td>
                      <td className="px-3 py-2 text-zinc-200 max-w-md truncate">
                        {m?.question ?? (
                          <span className="text-zinc-500 font-mono text-xs">
                            {e.marketId.slice(0, 12)}…
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            isYes
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-rose-500/15 text-rose-300"
                          }`}
                        >
                          {outcome.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-zinc-300">
                        {bp(e.probBP)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-zinc-300">
                        {bp(e.probBP - e.edgeBP)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono text-xs ${
                          Math.abs(e.edgeBP) > 1000
                            ? "text-amber-300"
                            : "text-zinc-300"
                        }`}
                      >
                        {e.edgeBP > 0 ? "+" : ""}
                        {bp(Math.abs(e.edgeBP))}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-zinc-400">
                        {bp(e.kellyFracBP)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <a
                          className="text-xs text-zinc-500 hover:text-zinc-300 underline"
                          href={`https://testnet.arcscan.app/tx/${e.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          ↗
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950">
      <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]">
        {label}
      </div>
      <div className="font-mono text-xl text-zinc-100 mt-1">{value}</div>
    </div>
  );
}
