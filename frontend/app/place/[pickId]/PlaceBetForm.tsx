"use client";

import { useState } from "react";
import { createWalletClient, custom, type WalletClient } from "viem";
import { mainnet } from "viem/chains";

const POLYGON_CHAIN_ID = 137;
const POLYMARKET_HOST = "https://clob.polymarket.com";
const BUILDER_CODE = process.env.NEXT_PUBLIC_POLYMARKET_BUILDER_CODE!;

type State =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "connected"; address: `0x${string}` }
  | { kind: "deriving" }
  | { kind: "ready"; address: `0x${string}` }
  | { kind: "submitting" }
  | { kind: "success"; orderID: string }
  | { kind: "error"; message: string };

type Props = {
  tokenId: string;
  conditionId: string;
  recommendedPrice: number;
  outcomeLabel: string;
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export function PlaceBetForm({
  tokenId,
  conditionId,
  recommendedPrice,
  outcomeLabel,
}: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [size, setSize] = useState<string>("10");
  const [price, setPrice] = useState<string>(recommendedPrice.toFixed(2));
  const [signer, setSigner] = useState<WalletClient | null>(null);
  // Holds the derived L2 API creds after the user signs once.
  // Kept in state (not localStorage) so we don't persist sensitive material.
  const [creds, setCreds] = useState<unknown | null>(null);

  async function connect() {
    if (!window.ethereum) {
      setState({
        kind: "error",
        message:
          "No wallet detected. Install MetaMask, Rabby, or another EIP-1193 wallet.",
      });
      return;
    }
    setState({ kind: "connecting" });
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as `0x${string}`[];
      const address = accounts[0];
      // Ask wallet to switch to Polygon
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${POLYGON_CHAIN_ID.toString(16)}` }],
        });
      } catch {
        // user may decline / chain may not be added; continue and let SDK error surface
      }
      const wallet = createWalletClient({
        account: address,
        chain: mainnet, // chain id is enforced at the SDK level via `chain: 137`
        transport: custom(window.ethereum),
      });
      setSigner(wallet);
      setState({ kind: "connected", address });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  }

  async function deriveCreds() {
    if (!signer) return;
    setState({ kind: "deriving" });
    try {
      const mod = await import("@polymarket/clob-client-v2");
      // viem WalletClient is accepted by the SDK as the signer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const temp = new mod.ClobClient({
        host: POLYMARKET_HOST,
        chain: POLYGON_CHAIN_ID,
        signer: signer as unknown as any,
      });
      const apiCreds = await temp.createOrDeriveApiKey();
      setCreds(apiCreds);
      const addr = (state as { kind: "connected"; address: `0x${string}` }).address;
      setState({ kind: "ready", address: addr });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  }

  async function submit() {
    if (!signer || !creds) return;
    const addr =
      state.kind === "ready" ? state.address : (state as { address: `0x${string}` }).address;
    setState({ kind: "submitting" });
    try {
      const mod = await import("@polymarket/clob-client-v2");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = new mod.ClobClient({
        host: POLYMARKET_HOST,
        chain: POLYGON_CHAIN_ID,
        signer: signer as unknown as any,
        creds: creds as any,
        signatureType: mod.SignatureTypeV2.EOA,
        funderAddress: addr,
      });

      const sizeNum = parseFloat(size);
      const priceNum = parseFloat(price);

      const resp = await client.createAndPostOrder(
        {
          tokenID: tokenId,
          price: priceNum,
          size: sizeNum,
          side: mod.Side.BUY,
          builderCode: BUILDER_CODE,
        },
        { tickSize: "0.01", negRisk: false },
      );

      const orderID = (resp?.orderID as string) ?? "submitted";
      setState({ kind: "success", orderID });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  }

  return (
    <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">
          Buy {outcomeLabel.toUpperCase()} on Polymarket
        </h3>
        <span className="text-[10px] text-zinc-500 font-mono">
          builder {BUILDER_CODE.slice(0, 10)}…{BUILDER_CODE.slice(-8)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="text-zinc-500 uppercase tracking-wider">
            Price (pUSD)
          </span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="0.99"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded font-mono text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs">
          <span className="text-zinc-500 uppercase tracking-wider">
            Size (shares)
          </span>
          <input
            type="number"
            step="1"
            min="1"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded font-mono text-sm text-zinc-100"
          />
        </label>
      </div>

      <p className="text-xs text-zinc-500">
        Notional ≈{" "}
        <span className="text-zinc-200 font-mono">
          ${(parseFloat(price || "0") * parseFloat(size || "0")).toFixed(2)} pUSD
        </span>{" "}
        · market: <span className="font-mono text-zinc-400">{conditionId.slice(0, 10)}…</span>
      </p>

      {state.kind === "idle" && (
        <button
          onClick={connect}
          className="w-full px-4 py-2 bg-zinc-100 text-zinc-950 rounded font-semibold text-sm hover:bg-white"
        >
          1. Connect wallet
        </button>
      )}
      {state.kind === "connecting" && (
        <button disabled className="w-full px-4 py-2 bg-zinc-800 text-zinc-500 rounded text-sm">
          Connecting…
        </button>
      )}
      {state.kind === "connected" && (
        <button
          onClick={deriveCreds}
          className="w-full px-4 py-2 bg-zinc-100 text-zinc-950 rounded font-semibold text-sm hover:bg-white"
        >
          2. Sign to derive Polymarket API creds
        </button>
      )}
      {state.kind === "deriving" && (
        <button disabled className="w-full px-4 py-2 bg-zinc-800 text-zinc-500 rounded text-sm">
          Waiting for signature…
        </button>
      )}
      {state.kind === "ready" && (
        <button
          onClick={submit}
          className="w-full px-4 py-2 bg-emerald-500 text-zinc-950 rounded font-semibold text-sm hover:bg-emerald-400"
        >
          3. Place order
        </button>
      )}
      {state.kind === "submitting" && (
        <button disabled className="w-full px-4 py-2 bg-zinc-800 text-zinc-500 rounded text-sm">
          Submitting to CLOB…
        </button>
      )}
      {state.kind === "success" && (
        <div className="px-4 py-3 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-sm">
          Order submitted. ID:{" "}
          <span className="font-mono">{state.orderID}</span>
        </div>
      )}
      {state.kind === "error" && (
        <div className="px-4 py-3 rounded border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs">
          {state.message}
        </div>
      )}
    </div>
  );
}
