import { CircleSmartAccountPanel } from "./CircleSmartAccountPanel";

export const dynamic = "force-dynamic";

export default function WalletPage() {
  const clientKey = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY ?? "";
  const clientUrl = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL ?? "";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← back to feed
        </a>
        <header className="mt-4 border-b border-zinc-800 pb-6">
          <div className="text-[10px] tracking-[0.3em] uppercase text-amber-300">
            Circle Modular Wallets
          </div>
          <h1 className="text-3xl font-serif mt-2">Passkey wallet</h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-xl leading-relaxed">
            Sign in with a passkey, get a Circle Smart Account (ERC-4337,
            ERC-6900) on Polygon Amoy. Gas is sponsored by Circle Gas
            Station — zero ETH required to bet. This is the same wallet
            type the production frontend would use to sign Polymarket V2
            orders with our builder code attached (via POLY_1271
            signature type).
          </p>
        </header>

        <section className="mt-8">
          <CircleSmartAccountPanel
            clientKey={clientKey}
            clientUrl={clientUrl}
          />
        </section>

        <section className="mt-10 border border-zinc-800 rounded-lg p-5 bg-zinc-950 text-sm">
          <h2 className="font-semibold text-zinc-200">How it fits in</h2>
          <ol className="mt-3 space-y-2 text-zinc-400 list-decimal list-inside text-xs leading-relaxed">
            <li>
              User taps <code>register passkey</code>. Browser prompts for
              biometric / device PIN; WebAuthn creates a P256 credential
              bound to <code>oracle.thecanteenapp.com</code>.
            </li>
            <li>
              SDK deploys a Circle Smart Account (MSCA) on first outbound
              tx — lazy deploy, no setup gas.
            </li>
            <li>
              When the user clicks <em>Place bet</em>, Polymarket V2 order
              is wrapped as a user op and submitted via the bundler.
              Circle Paymaster sponsors gas; user signs once with passkey.
            </li>
            <li>
              Builder code (<code>0x1bf6…f217b9</code>) rides on the same
              order — Polymarket attributes the volume back to us.
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
