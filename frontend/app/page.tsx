import Link from "next/link";

import { LiveTicker } from "./components/LiveTicker";
import { ShareBar } from "./components/ShareBar";
import { PICK_LEDGER_ADDRESS, type PickEvent } from "@/lib/arc";
import { getMarketMeta, polymarketUrl, type MarketMeta } from "@/lib/polymarket";
import { fetchReasoning, type ReasoningBlob } from "@/lib/reasoning";
import { fmtUSDC, getAgentStats, type AgentStats } from "@/lib/stats";

// Cache for 60s. Picks change in the background as the brain runs; the
// home page doesn't need real-time freshness, and ISR keeps the page fast
// on Vercel's edge.
export const revalidate = 60;

type EnrichedPick = {
  event: PickEvent;
  market: MarketMeta | null;
  reasoning: ReasoningBlob | null;
};

async function load(): Promise<{ stats: AgentStats; picks: EnrichedPick[] }> {
  const { stats, events } = await getAgentStats();
  // Show the 12 most-recent picks on the home page. The full track record
  // lives at /agent/[address] and isn't capped.
  const picks = await Promise.all(
    events.slice(0, 12).map(async (event) => {
      const [market, reasoning] = await Promise.all([
        getMarketMeta(event.marketId),
        fetchReasoning(event.reasoningURI),
      ]);
      return { event, market, reasoning };
    }),
  );
  return { stats, picks };
}

function bp(n: number): string {
  return `${(n / 100).toFixed(1)}%`;
}

function ConfidencePill({ c }: { c: string }) {
  const colors: Record<string, string> = {
    high: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    medium: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    low: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs uppercase tracking-wider border ${colors[c] ?? colors.low}`}
    >
      {c}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950">
      <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]">
        {label}
      </div>
      <div className="font-mono text-2xl text-zinc-100 mt-1">{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

function PickCard({ pick }: { pick: EnrichedPick }) {
  const { event, market, reasoning } = pick;
  const outcome =
    reasoning?.outcome_label ?? (event.edgeBP >= 0 ? "Yes" : "No");
  const question = market?.question ?? "Loading market…";
  const liquidity = market
    ? `$${Math.round(market.liquidity).toLocaleString()}`
    : "—";
  const isYes = outcome.toLowerCase() === "yes";
  const marketProbBP = event.probBP - event.edgeBP;

  return (
    <article className="border border-zinc-800 bg-zinc-950 rounded-lg p-5 hover:border-zinc-700 transition-colors">
      <header className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-zinc-100 leading-snug">
            {question}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            on-chain id #{event.pickId.toString()} · block{" "}
            <a
              className="underline hover:text-zinc-300"
              href={`https://testnet.arcscan.app/tx/${event.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {event.blockNumber.toString()}
            </a>
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded font-mono font-bold text-sm whitespace-nowrap ${
            isYes
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
              : "bg-rose-500/15 text-rose-300 border border-rose-500/40"
          }`}
        >
          {outcome.toUpperCase()}
        </span>
      </header>

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <Stat label="agent says" value={bp(event.probBP)} />
        <Stat label="market says" value={bp(marketProbBP)} />
        <Stat
          label="edge"
          value={`${event.edgeBP > 0 ? "+" : ""}${bp(Math.abs(event.edgeBP))}`}
          highlight={Math.abs(event.edgeBP) > 1000}
        />
      </div>

      {reasoning?.reasoning && (
        <p className="text-sm text-zinc-300 mb-3 leading-relaxed">
          {reasoning.reasoning}
        </p>
      )}

      {reasoning?.evidence_points?.length ? (
        <ul className="text-xs text-zinc-400 space-y-1 mb-4 list-disc list-inside">
          {reasoning.evidence_points.slice(0, 4).map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      ) : null}

      <footer className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-800">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          {reasoning?.confidence && <ConfidencePill c={reasoning.confidence} />}
          <span>kelly {bp(event.kellyFracBP)}</span>
          <span>liquidity {liquidity}</span>
        </div>
        {market?.slug ? (
          <div className="flex items-center gap-2">
            <Link
              href={polymarketUrl(market.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded border border-zinc-700 hover:border-zinc-500 text-zinc-300"
            >
              View on Polymarket
            </Link>
            <Link
              href={`/place/${event.pickId.toString()}`}
              className="text-xs font-semibold px-3 py-1.5 rounded bg-zinc-100 text-zinc-950 hover:bg-white"
            >
              Place bet →
            </Link>
          </div>
        ) : null}
      </footer>
    </article>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="border border-zinc-800 rounded px-2 py-1.5 bg-zinc-950">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
        {label}
      </div>
      <div
        className={`font-mono text-sm ${highlight ? "text-amber-300" : "text-zinc-200"}`}
      >
        {value}
      </div>
    </div>
  );
}

export default async function Home() {
  const { stats, picks } = await load();
  const avgEdgeBP = stats.picks ? stats.edgeSumAbs / stats.picks : 0;

  const tickerItems = picks.slice(0, 8).map((p) => {
    const outcome =
      p.reasoning?.outcome_label ?? (p.event.edgeBP >= 0 ? "Yes" : "No");
    return {
      id: p.event.txHash,
      text:
        `${outcome.toUpperCase()} on  · ` +
        (p.market?.question ?? p.event.marketId.slice(0, 16)),
      hint: `#${p.event.pickId.toString()} · ${(Math.abs(p.event.edgeBP) / 100).toFixed(1)}% edge`,
    };
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* HERO */}
      <header className="border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
              agora agents hackathon · canteen × circle
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/wallet"
                className="text-xs px-3 py-1.5 rounded border border-zinc-700 hover:border-zinc-500 text-zinc-300"
                title="Circle Modular Wallets"
              >
                Passkey wallet
              </Link>
              <ShareBar
                url="https://oracle.thecanteenapp.com"
                text="Oracle — AI prediction-market agent. Every pick signed on Arc, every fill carries our builder code, fees home via Circle CCTPv2."
              />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-serif tracking-tight leading-none">
            Oracle.
          </h1>
          <p className="text-lg text-zinc-300 mt-4 max-w-2xl leading-relaxed">
            An AI prediction-market agent that{" "}
            <span className="text-zinc-100">signs every pick on Arc</span>,
            attaches its builder code to every fill on Polymarket V2, and
            bridges the resulting USDC fees home via{" "}
            <span className="text-zinc-100">Circle CCTPv2</span>.
          </p>
          <p className="text-sm text-zinc-500 mt-3 max-w-2xl">
            Reasoning traces are first-class. Every recommendation lives on{" "}
            <a
              className="underline hover:text-zinc-300"
              href={`https://testnet.arcscan.app/address/${PICK_LEDGER_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Arc Testnet
            </a>{" "}
            forever, hash-anchored to the full trace.
          </p>
        </div>
        <LiveTicker items={tickerItems} />
      </header>

      {/* STATS */}
      <section className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="picks signed"
            value={stats.picks.toString()}
            sub="on Arc Testnet"
          />
          <StatCard
            label="avg edge"
            value={bp(avgEdgeBP)}
            sub="vs market price"
          />
          <StatCard
            label="yes / no"
            value={`${stats.yesPicks} / ${stats.noPicks}`}
            sub="position direction"
          />
          <StatCard
            label="treasury"
            value={`${fmtUSDC(stats.treasuryBalanceWei)} USDC`}
            sub="agent EOA on Arc"
          />
        </div>

        {/* HOW IT WORKS */}
        <div className="mt-10 grid md:grid-cols-3 gap-4 text-sm">
          <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950">
            <div className="text-amber-300 font-mono text-xs tracking-wider">
              01 · ANALYZE
            </div>
            <div className="mt-2 text-zinc-200 font-semibold">
              DeepSeek-V4 Pro reads each market.
            </div>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
              Pulls open Polymarket markets, estimates true probability,
              computes edge over market price, sizes via Kelly.
            </p>
          </div>
          <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950">
            <div className="text-amber-300 font-mono text-xs tracking-wider">
              02 · SIGN
            </div>
            <div className="mt-2 text-zinc-200 font-semibold">
              Pick emits on Arc, hash-anchored.
            </div>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
              Recommendation + reasoning trace + Kelly size become a single
              `Pick` event. Trail is immutable.
            </p>
          </div>
          <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950">
            <div className="text-amber-300 font-mono text-xs tracking-wider">
              03 · MONETIZE
            </div>
            <div className="mt-2 text-zinc-200 font-semibold">
              Orders carry our builder code.
            </div>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
              Click "Place bet" — Polymarket V2 SDK signs your order with our
              `bytes32 builderCode`. Filled fees flow back via Circle CCTPv2.
            </p>
          </div>
        </div>
      </section>

      {/* FEED */}
      <section className="max-w-4xl mx-auto px-6 pb-16 space-y-4">
        <div className="flex items-baseline justify-between border-b border-zinc-800 pb-2 mb-4">
          <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-zinc-400">
            recent picks
          </h2>
          {stats.agentAddress && (
            <Link
              href={`/agent/${stats.agentAddress}`}
              className="text-xs text-zinc-500 hover:text-zinc-300 underline"
            >
              full agent profile →
            </Link>
          )}
        </div>
        {picks.length === 0 ? (
          <p className="text-zinc-500 text-sm">
            No picks yet. The oracle is thinking.
          </p>
        ) : (
          picks.map((p) => <PickCard key={p.event.txHash} pick={p} />)
        )}
      </section>
    </main>
  );
}
