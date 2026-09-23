# Cove

Secure AI wallet assistant built on the **Trust Wallet Agent Kit** (HMAC REST API at `tws.trustwallet.com`) and an **injected wallet signing layer**.

Ask in plain language. Review every quote. Sign only in your wallet. Recovery phrases never leave this device.

## What it does

- Natural-language chat for balances, prices, swap quotes, routes, sends, and tx status
- Wallet connect (Trust Wallet / any EIP-1193 injected provider) or watch-only address
- Ethereum, BNB Smart Chain, Polygon, Arbitrum, Optimism, Base, Avalanche, Solana
- Swap quotes and routes from Trust Wallet Amber (`POST /amber-api/v1/route`)
- Two-step confirmation before anything is signed; extra confirm for high-value (~$1,000+)
- Local BIP-39 Secure Phrase Check (word split, numbering, concatenation, English list, checksum) — **never sent to the AI or a server**
- Chat blocks pasted mnemonics and private keys before they leave the browser

## Security model

```
AI / chat  →  intent  →  quote (Trust Wallet API)  →  you confirm  →  wallet signs  →  chain
```

The model never receives:

- Secret Recovery Phrase
- Private keys
- PIN / password
- HMAC secrets or API keys

Signing uses `eth_sendTransaction` in the connected wallet. Watch-only mode can inspect and quote, not sign.

## Environment variables

Create a local `.env` from the example. **Do not put secrets in frontend code or `VITE_*` variables.**

| Variable | Purpose |
|---|---|
| `XAI_API_KEY` | xAI Grok chat (also accepted: `API_KEY`, `GROK_API_KEY`) |
| `TWAK_ACCESS_ID` | Trust Wallet Agent Kit access id (also accepted: `AGENT_KIT_ID`, `TWAK_AGENT_KIT_ID`) |
| `TWAK_HMAC_SECRET` | HMAC secret from [portal.trustwallet.com](https://portal.trustwallet.com) |

```bash
cp .env.example .env
```

On this Grok preview, `XAI_API_KEY` is injected automatically. Market data, search, and swap quotes need Trust Wallet portal credentials on the **server**. Without them, on-chain balances and wallet signing still work.

Get Agent Kit credentials: [Trust Wallet developer portal](https://portal.trustwallet.com) → create an app → Access ID + HMAC secret.

Docs: [Agent SDK](https://developer.trustwallet.com/developer/agent-sdk.md) · [CLI reference](https://developer.trustwallet.com/developer/agent-sdk/cli-reference.md) · [Skills](https://github.com/trustwallet/tw-agent-skills)

## Run locally

```bash
npm install
cp .env.example .env   # fill in keys
npm run dev            # http://localhost:8080
```

```bash
npm run typecheck
npm run build
```

## Architecture

| Layer | Where | Role |
|---|---|---|
| Chat / AI | `src/lib/agent/` | Grok (`grok-4.5`) with tools. No keys, no phrases. |
| Trust Wallet API | `src/lib/trustwallet/` | HMAC-SHA256 to `https://tws.trustwallet.com` |
| On-chain reads | `src/lib/wallet/onchain.server.ts` | viem public RPC (balances, gas, receipts, ENS) |
| Signing | `src/lib/wallet/injected.ts` + `execute.ts` | Browser wallet only |
| BIP-39 | `src/lib/bip39/checker.ts` | Client-only |

Documented Trust Wallet endpoints used:

- `GET /v1/search/assets`
- `POST /v2/market/tickers`
- `GET /v1/assets/listings`
- `GET /v1/validate`
- `GET /v2/coinstatus/{assetId}`
- `GET /amber-api/v1/domains`
- `GET /amber-api/v1/providers`
- `POST /amber-api/v1/route`
- `POST /amber-api/v1/route/step`

## Confirmation

1. You ask to swap or send.
2. Cove shows input, output, rate, slippage, network, fee, route, min received, recipient.
3. You press **Confirm**. High-value needs a second confirm.
4. The wallet popup is the only signing surface.

## License

MIT
