"use client";

import { useState } from "react";

type Props = {
  clientKey: string;
  clientUrl: string;
};

type State =
  | { kind: "idle" }
  | { kind: "registering" }
  | { kind: "ready"; address: `0x${string}` }
  | { kind: "error"; message: string };

export function CircleSmartAccountPanel({ clientKey, clientUrl }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const configured = clientKey && clientUrl;

  async function register() {
    if (!configured) return;
    setState({ kind: "registering" });
    try {
      // Lazy-load the SDK only when actually invoked.
      const sdk = await import("@circle-fin/modular-wallets-core");
      const passkeyTransport = sdk.toPasskeyTransport(clientUrl, clientKey);

      // Register a new WebAuthn credential.
      const credential = await sdk.toWebAuthnCredential({
        transport: passkeyTransport,
        mode: sdk.WebAuthnMode.Register,
        username: `oracle-user-${Date.now()}`,
      });

      // Bridge into a viem-compatible WebAuthn account.
      const owner = await import("viem/account-abstraction").then((m) =>
        m.toWebAuthnAccount({ credential }),
      );

      const polygonAmoyUrl = `${clientUrl}/polygonAmoy`;
      const modularTransport = sdk.toModularTransport(
        polygonAmoyUrl,
        clientKey,
      );

      const { createPublicClient } = await import("viem");
      const polygonAmoy = await import("viem/chains").then((m) => m.polygonAmoy);
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: modularTransport,
      });

      const account = await sdk.toCircleSmartAccount({
        client: publicClient,
        owner,
      });

      setState({ kind: "ready", address: account.address });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  }

  if (!configured) {
    return (
      <div className="border border-amber-500/40 bg-amber-500/5 rounded-lg p-5 text-sm space-y-3">
        <div className="text-amber-300 font-mono text-xs tracking-wider">
          NOT CONFIGURED
        </div>
        <p className="text-zinc-300">
          This page becomes live once you set up Circle Console:
        </p>
        <ol className="text-xs text-zinc-400 space-y-1 list-decimal list-inside">
          <li>
            Sign up at{" "}
            <a
              className="underline"
              href="https://console.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              console.circle.com
            </a>
            .
          </li>
          <li>Create a Client Key + configure the Passkey Domain to your deployed origin.</li>
          <li>
            Set <code className="text-zinc-200">NEXT_PUBLIC_CIRCLE_CLIENT_KEY</code> and{" "}
            <code className="text-zinc-200">NEXT_PUBLIC_CIRCLE_CLIENT_URL</code> in
            your frontend env.
          </li>
          <li>Redeploy. This panel will turn on automatically.</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">
          Passkey · Circle Smart Account
        </h3>
        <span className="text-[10px] text-zinc-500 font-mono">
          chain: Polygon Amoy testnet
        </span>
      </div>

      {state.kind === "idle" && (
        <button
          onClick={register}
          className="w-full px-4 py-2 bg-zinc-100 text-zinc-950 rounded font-semibold text-sm hover:bg-white"
        >
          Register passkey & create smart account
        </button>
      )}
      {state.kind === "registering" && (
        <button
          disabled
          className="w-full px-4 py-2 bg-zinc-800 text-zinc-500 rounded text-sm"
        >
          Waiting for passkey…
        </button>
      )}
      {state.kind === "ready" && (
        <div className="space-y-2">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">
            smart account
          </div>
          <div className="font-mono text-sm text-emerald-300 break-all">
            {state.address}
          </div>
          <p className="text-xs text-zinc-500">
            Lazy-deployed; first user operation pays the deploy gas. Circle
            Paymaster (Gas Station) sponsors it when{" "}
            <code>paymaster: true</code> is set on the user op.
          </p>
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
