import { createPublicClient, http, parseAbi, type Log } from "viem";

export const ARC_CHAIN = {
  id: 5042002,
  name: "Arc Testnet",
  network: "arc-testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.ARC_RPC_URL!] },
    public: { http: [process.env.ARC_RPC_URL!] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
} as const;

export const PICK_LEDGER_ADDRESS = process.env
  .NEXT_PUBLIC_PICK_LEDGER_ADDRESS as `0x${string}`;

export const PICK_LEDGER_ABI = parseAbi([
  "event Pick(address indexed agent, uint256 indexed id, bytes32 indexed marketId, uint256 tokenId, uint8 side, uint16 probBP, int16 edgeBP, uint16 kellyFracBP, bytes32 reasoningHash, string reasoningURI, uint64 expiresAt)",
  "event AgentRegistered(address indexed agent, string name)",
]);

export const publicClient = createPublicClient({
  chain: ARC_CHAIN,
  transport: http(process.env.ARC_RPC_URL),
});

export type PickEvent = {
  agent: `0x${string}`;
  pickId: bigint;
  marketId: `0x${string}`;
  tokenId: bigint;
  side: number;
  probBP: number;
  edgeBP: number;
  kellyFracBP: number;
  reasoningHash: `0x${string}`;
  reasoningURI: string;
  expiresAt: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
};

export async function fetchPicks(opts: {
  agent?: `0x${string}`;
  fromBlock?: bigint;
  limit?: number;
} = {}): Promise<PickEvent[]> {
  const logs = await publicClient.getLogs({
    address: PICK_LEDGER_ADDRESS,
    event: PICK_LEDGER_ABI[0],
    args: opts.agent ? { agent: opts.agent } : undefined,
    fromBlock: opts.fromBlock ?? 42440000n,
    toBlock: "latest",
  });
  const picks: PickEvent[] = logs.map((log: Log<bigint, number, false, typeof PICK_LEDGER_ABI[0]>) => {
    const a = log.args;
    return {
      agent: a.agent!,
      pickId: a.id!,
      marketId: a.marketId!,
      tokenId: a.tokenId!,
      side: a.side!,
      probBP: a.probBP!,
      edgeBP: a.edgeBP!,
      kellyFracBP: a.kellyFracBP!,
      reasoningHash: a.reasoningHash!,
      reasoningURI: a.reasoningURI!,
      expiresAt: a.expiresAt!,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
    };
  });
  picks.sort((x, y) => (y.blockNumber - x.blockNumber > 0n ? 1 : -1));
  return opts.limit ? picks.slice(0, opts.limit) : picks;
}
