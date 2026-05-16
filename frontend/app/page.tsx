import Link from "next/link";

import { fetchPicks, PICK_LEDGER_ADDRESS, type PickEvent } from "@/lib/arc";
import { getMarketMeta, polymarketUrl, type MarketMeta } from "@/lib/polymarket";
import { fetchReasoning, type ReasoningBlob } from "@/lib/reasoning";

export const dynamic = "force-dynamic";

type EnrichedPick = {
  event: PickEvent;
  market: MarketMeta | null;
  reasoning: ReasoningBlob | null;
};

async function load(): Promise<EnrichedPick[]> {
  const events = await fetchPicks({ limit: 50 });
  return Promise.all(
    events.map(async (event) => {
      const [market, reasoning] = await Promise.all([
        getMarketMeta(event.marketId),
        fetchReasoning(event.reasoningURI),
      ]);
      return { event, market, reasoning };
    }),
  );
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

function PickCard({ pick }: { pick: EnrichedPick }) {
  const { event, market, reasoning } = pick;
  const outcome =
    reasoning?.outcome_label ?? (event.edgeBP >= 0 ? "Yes" : "No");
  const question = market?.question ?? "Loading market…";
  const liquidity = market ? `$${Math.round(market.liquidity).toLocaleString()}` : "—";
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
  const picks = await load();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-8 max-w-3xl mx-auto">
        <h1 className="text-3xl font-serif tracking-tight">Oracle</h1>
        <p className="text-sm text-zinc-400 mt-2 max-w-xl">
          AI-signed prediction-market picks, published on{" "}
          <a
            className="underline"
            href={`https://testnet.arcscan.app/address/${PICK_LEDGER_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Arc testnet
          </a>
          . Every recommendation lives on-chain forever — agent name + market +
          recommended side + reasoning hash. Click a card to follow a pick on
          Polymarket.
        </p>
        <p className="text-xs text-zinc-500 mt-3">
          Agora Agents Hackathon · Canteen × Circle · 2026
        </p>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-8 space-y-4">
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
