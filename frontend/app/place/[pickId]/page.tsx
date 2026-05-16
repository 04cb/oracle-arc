import Link from "next/link";
import { notFound } from "next/navigation";

import { fetchPicks } from "@/lib/arc";
import { getMarketMeta } from "@/lib/polymarket";
import { fetchReasoning } from "@/lib/reasoning";

import { PlaceBetForm } from "./PlaceBetForm";

export const dynamic = "force-dynamic";

type Params = Promise<{ pickId: string }>;

export default async function Page({ params }: { params: Params }) {
  const { pickId } = await params;
  const events = await fetchPicks({ limit: 200 });
  const event = events.find((e) => e.pickId.toString() === pickId);
  if (!event) notFound();

  const [market, reasoning] = await Promise.all([
    getMarketMeta(event.marketId),
    fetchReasoning(event.reasoningURI),
  ]);

  if (!market) notFound();

  const outcomeLabel =
    reasoning?.outcome_label ?? (event.edgeBP >= 0 ? "Yes" : "No");
  const idx = market.outcomes.findIndex(
    (o) => o.toLowerCase() === outcomeLabel.toLowerCase(),
  );
  const tokenId = idx >= 0 ? market.outcomeTokenIds[idx] : market.outcomeTokenIds[0];
  const recommendedPrice = idx >= 0 ? market.outcomePrices[idx] : 0.5;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-6 max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← all picks
        </Link>
        <h1 className="text-xl font-serif tracking-tight mt-2">
          Follow this pick
        </h1>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-5">
          <h2 className="text-base font-semibold text-zinc-100">
            {market.question}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Oracle recommends{" "}
            <strong className="text-zinc-200">{outcomeLabel.toUpperCase()}</strong>{" "}
            · agent p={(event.probBP / 100).toFixed(1)}% · market p=
            {((event.probBP - event.edgeBP) / 100).toFixed(1)}% · edge{" "}
            {event.edgeBP > 0 ? "+" : ""}
            {(event.edgeBP / 100).toFixed(1)}%
          </p>
          {reasoning?.reasoning && (
            <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
              {reasoning.reasoning}
            </p>
          )}
        </div>

        <PlaceBetForm
          tokenId={tokenId}
          conditionId={event.marketId}
          recommendedPrice={recommendedPrice}
          outcomeLabel={outcomeLabel}
        />

        <p className="text-xs text-zinc-500 leading-relaxed">
          Orders are submitted directly to Polymarket&apos;s CLOB with{" "}
          Oracle&apos;s builder code attached. Polymarket pays the gas via its
          relayer. You need an existing Polymarket account with deposited pUSD
          for this to settle — fund at{" "}
          <a
            className="underline"
            href="https://polymarket.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            polymarket.com
          </a>{" "}
          first.
        </p>
      </section>
    </main>
  );
}
