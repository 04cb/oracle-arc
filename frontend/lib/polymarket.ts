const GAMMA = "https://gamma-api.polymarket.com";

export type MarketMeta = {
  conditionId: string;
  question: string;
  slug: string;
  description: string;
  outcomes: string[];
  outcomePrices: number[];
  outcomeTokenIds: string[];
  endDate: string | null;
  liquidity: number;
  volume: number;
  image: string | null;
};

const cache = new Map<string, { at: number; data: MarketMeta | null }>();
const TTL_MS = 60_000;

export async function getMarketMeta(
  conditionId: string,
): Promise<MarketMeta | null> {
  const now = Date.now();
  const hit = cache.get(conditionId);
  if (hit && now - hit.at < TTL_MS) return hit.data;

  try {
    const res = await fetch(
      `${GAMMA}/markets?condition_ids=${conditionId}&limit=1`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) {
      cache.set(conditionId, { at: now, data: null });
      return null;
    }
    const json = (await res.json()) as unknown;
    const raw = Array.isArray(json) ? (json[0] as Record<string, unknown>) : null;
    if (!raw) {
      cache.set(conditionId, { at: now, data: null });
      return null;
    }
    const outcomes = JSON.parse(String(raw.outcomes ?? "[]")) as string[];
    const prices = (JSON.parse(String(raw.outcomePrices ?? "[]")) as string[]).map(Number);
    const tokenIds = JSON.parse(String(raw.clobTokenIds ?? "[]")) as string[];
    const meta: MarketMeta = {
      conditionId: String(raw.conditionId ?? ""),
      question: String(raw.question ?? ""),
      slug: String(raw.slug ?? ""),
      description: String(raw.description ?? ""),
      outcomes,
      outcomePrices: prices,
      outcomeTokenIds: tokenIds,
      endDate: raw.endDate ? String(raw.endDate) : null,
      liquidity: Number(raw.liquidity ?? 0),
      volume: Number(raw.volume ?? 0),
      image: raw.image ? String(raw.image) : null,
    };
    cache.set(conditionId, { at: now, data: meta });
    return meta;
  } catch {
    cache.set(conditionId, { at: now, data: null });
    return null;
  }
}

export function polymarketUrl(slug: string): string {
  return `https://polymarket.com/event/${slug}`;
}
