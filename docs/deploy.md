# Deploy

The frontend is a single Next.js 16 app. For the hackathon demo it needs a
public URL so judges can click through without spinning up your dev server.

## Recommended: Vercel

The frontend was scaffolded with `create-next-app`, so Vercel is the
zero-config path.

### One-time setup

1. Push the repo to GitHub (a private repo is fine).
   ```bash
   gh repo create oracle --private --source=. --remote=origin --push
   ```
2. Go to https://vercel.com/new, import your GitHub repo.
3. Vercel auto-detects Next.js. Set the **root directory** to `frontend/`.
4. Add the following environment variables (Vercel → Project → Settings →
   Environment Variables):

   | Name | Value | Notes |
   |---|---|---|
   | `ARC_RPC_URL` | `https://rpc.testnet.arc-node.thecanteenapp.com/v1/<your-token>` | Get via `arc-canteen rpc-url`. Sensitive — server-only. |
   | `NEXT_PUBLIC_PICK_LEDGER_ADDRESS` | `0x762cc26e9CE5A7D3FcCB3C09d3f2d54c25EaBC2b` | |
   | `NEXT_PUBLIC_REPUTATION_REGISTRY` | `0x1F4C93d8a8005601b2E89d163Ffe7992344f5DA6` | |
   | `NEXT_PUBLIC_POLYMARKET_BUILDER_CODE` | `0x1bf684d4371715597038e7f7a28ca992bb9cf226ec8c66182db09e143fa217b9` | |
   | `NEXT_PUBLIC_POLYMARKET_BUILDER_ADDRESS` | `0x5447bb168ae8d63ac222beb411ee148f5b649383` | |

5. **Reasoning blobs:** Vercel deploys are stateless — they will NOT have
   access to `~/code/arc/reasoning/`. For the first deploy this means the
   reasoning text on cards will be missing. Either:
   - **Quick fix:** commit `reasoning/` to the repo (remove from `.gitignore`).
     Cost: ~30KB per pick.
   - **Proper fix:** upload reasoning blobs to a public bucket / IPFS, swap
     `oracle://` URIs for `https://...` URIs at publish time (see
     `brain/oracle/chain.py`'s `_save_reasoning`).
6. Deploy.

The same configuration drives a CLI deploy if you'd rather not connect
GitHub:

```bash
cd frontend
npx --yes vercel@latest    # interactive: link or create project
npx --yes vercel@latest --prod
```

## Self-host alternative: any Node host

Anything that runs `npm run build && npm start` and exposes port 3000
works — Railway, Fly.io, Render, your own VM behind nginx.

```bash
cd frontend
npm install
npm run build
npm start   # port 3000
```

Put the env vars from the Vercel table above in `.env.local` (server) or
the host's environment.

## Don't deploy this stuff publicly

- The root `.env` contains your DeepSeek `ANTHROPIC_AUTH_TOKEN` and the
  agent's `AGENT_PRIVATE_KEY`. The frontend doesn't need either — keep them
  on your laptop.
- The `ARC_RPC_URL` includes a per-user RPC token. Treat as a secret. If it
  ever leaks, rotate via `arc-canteen rotate-rpc-key`.

## Custom domain

For the demo, `oracle.<yourname>.vercel.app` is fine. If you want a
custom domain, follow Vercel's docs — DNS is the only blocker.
