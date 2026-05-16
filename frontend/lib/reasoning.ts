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

// In dev / hackathon we resolve oracle://<hash> from a local directory.
// Production: switch to IPFS / Arweave or a CDN.
const LOCAL_DIR =
  process.env.REASONING_DIR ??
  path.resolve(process.cwd(), "..", "reasoning");

export async function fetchReasoning(
  uri: string,
): Promise<ReasoningBlob | null> {
  if (uri.startsWith("oracle://")) {
    const hash = uri.slice("oracle://".length);
    const fp = path.join(LOCAL_DIR, `${hash}.json`);
    try {
      const text = await fs.readFile(fp, "utf-8");
      return JSON.parse(text) as ReasoningBlob;
    } catch {
      return null;
    }
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
