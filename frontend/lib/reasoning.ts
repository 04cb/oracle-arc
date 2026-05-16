import { promises as fs } from "node:fs";
import path from "node:path";

export type ReasoningBlob = {
  market_id: string;
  market_question: string;
  outcome_label: string;
  side: number;
  my_probability_bp: number;
  market_probability_bp: number;
  edge_bp: number;
  confidence: string;
  kelly_fraction_bp: number;
  reasoning: string;
  evidence_points: string[];
  sources_consulted: string[];
  created_at: string;
  agent_version: string;
};

// Where to find oracle://<hash> blobs. Tried in order:
//   1. REASONING_DIR env (explicit override)
//   2. ./reasoning relative to frontend cwd — works on Vercel since the
//      blobs live at frontend/reasoning/ and are included in the build.
//   3. ../reasoning — legacy dev path (top-level repo).
function candidateDirs(): string[] {
  const out: string[] = [];
  if (process.env.REASONING_DIR) out.push(process.env.REASONING_DIR);
  out.push(path.resolve(process.cwd(), "reasoning"));
  out.push(path.resolve(process.cwd(), "..", "reasoning"));
  return out;
}

export async function fetchReasoning(
  uri: string,
): Promise<ReasoningBlob | null> {
  if (uri.startsWith("oracle://")) {
    const hash = uri.slice("oracle://".length);
    for (const dir of candidateDirs()) {
      try {
        const text = await fs.readFile(path.join(dir, `${hash}.json`), "utf-8");
        return JSON.parse(text) as ReasoningBlob;
      } catch {
        /* try next */
      }
    }
    return null;
  }
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    try {
      const res = await fetch(uri, { next: { revalidate: 600 } });
      if (!res.ok) return null;
      return (await res.json()) as ReasoningBlob;
    } catch {
      return null;
    }
  }
  return null;
}
