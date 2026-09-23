import { formatUnits, parseUnits } from "viem";
import { SYSTEM_PROMPT } from "./prompt";
import type {
  AgentCard,
  AgentResult,
  AssistantPayload,
  ClientMessage,
  PendingAction,
  PendingSend,
  PendingSwap,
  WalletContext,
} from "./types";
import { AppError, plainError } from "@/lib/wallet/errors";
import { NETWORKS, assetIdForToken, type NetworkKey, networkByKey } from "@/lib/wallet/networks";
import { findToken, nativeToken } from "@/lib/wallet/tokens";
import {
  estimateEvmTransfer,
  getTxReceipt,
  readEvmHoldings,
  readSolanaHoldings,
  resolveEns,
  type Holding,
} from "@/lib/wallet/onchain.server";
import {
  checkTokenSecurity,
  getSwapQuote,
  getTokenPrices,
  getTrending,
  searchAssets,
  twakConfigured,
  validateAddress,
} from "@/lib/trustwallet/api.server";
import { looksLikeSecret } from "./secret-guard";
import { formatUsd } from "@/lib/format";
import { getXaiApiKey } from "@/lib/env.server";

const HIGH_VALUE_USD = 1000;
const MODEL = "grok-4.5";

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type GrokMessage =
  | { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_call_id?: string; tool_calls?: ToolCall[] };

const tools = [
  {
    type: "function",
    function: {
      name: "get_balances",
      description: "Read native and known token balances for an address on a supported network.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string" },
          network: { type: "string", description: "ethereum, bsc, polygon, arbitrum, optimism, base, avalanche, solana" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_token_prices",
      description: "Live USD prices from Trust Wallet market data for asset ids or symbols like ETH, BNB, SOL, USDC.",
      parameters: {
        type: "object",
        properties: {
          symbols: { type: "array", items: { type: "string" } },
          network: { type: "string" },
        },
        required: ["symbols"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_tokens",
      description: "Search Trust Wallet assets by name, symbol, or contract.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          network: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_swap_quote",
      description: "Preview a swap quote without executing. Use for 'how much would I get' questions.",
      parameters: {
        type: "object",
        properties: {
          fromSymbol: { type: "string" },
          toSymbol: { type: "string" },
          amount: { type: "string" },
          network: { type: "string" },
          toNetwork: { type: "string" },
          slippage: { type: "string" },
        },
        required: ["fromSymbol", "toSymbol", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_swap",
      description:
        "Build a swap the user can confirm in the app. Never executes. Use when they asked to swap, not merely to price it.",
      parameters: {
        type: "object",
        properties: {
          fromSymbol: { type: "string" },
          toSymbol: { type: "string" },
          amount: { type: "string" },
          network: { type: "string" },
          toNetwork: { type: "string" },
          slippage: { type: "string" },
        },
        required: ["fromSymbol", "toSymbol", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_send",
      description: "Build a transfer the user can confirm in the app. Never executes or signs.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string" },
          amount: { type: "string" },
          to: { type: "string", description: "Destination address or ENS name" },
          network: { type: "string" },
        },
        required: ["token", "amount", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "validate_destination",
      description: "Validate a destination address with Trust Wallet security signals.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string" },
          network: { type: "string" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_token_security",
      description: "Token risk signals from Trust Wallet (honeypot, warnings).",
      parameters: {
        type: "object",
        properties: {
          symbolOrAssetId: { type: "string" },
          network: { type: "string" },
        },
        required: ["symbolOrAssetId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tx_status",
      description: "Look up a transaction by hash on the current or specified network.",
      parameters: {
        type: "object",
        properties: {
          hash: { type: "string" },
          network: { type: "string" },
        },
        required: ["hash"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_trending",
      description: "Trending tokens from Trust Wallet listings.",
      parameters: {
        type: "object",
        properties: { category: { type: "string" } },
        required: [],
      },
    },
  },
] as const;

function net(key: string | undefined, fallback: NetworkKey): NetworkKey {
  if (key && networkByKey(key)) return key as NetworkKey;
  return fallback;
}

function humanAmount(raw: string, decimals: number): string {
  try {
    return formatUnits(BigInt(raw), decimals);
  } catch {
    return raw;
  }
}

async function attachPrices(holdings: Holding[], network: NetworkKey): Promise<Holding[]> {
  if (!twakConfigured() || holdings.length === 0) return holdings;
  const ids = holdings.map((h) => assetIdForToken(NETWORKS[network], h.native ? null : h.address));
  try {
    const tickers = await getTokenPrices(ids);
    const map = new Map(tickers.map((t) => [t.id, t]));
    return holdings.map((h, i) => {
      const price = map.get(ids[i])?.price ?? null;
      const valueUsd = price == null ? null : price * Number(h.balance);
      return { ...h, priceUsd: price, valueUsd };
    });
  } catch {
    return holdings;
  }
}

async function loadHoldings(address: string, network: NetworkKey) {
  const base =
    NETWORKS[network].kind === "solana" ? await readSolanaHoldings(address) : await readEvmHoldings(address, network);
  return attachPrices(base, network);
}

async function buildSwap(input: {
  fromSymbol: string;
  toSymbol: string;
  amount: string;
  network: NetworkKey;
  toNetwork: NetworkKey;
  slippage: string;
  address: string;
}): Promise<{ swap: PendingSwap; routesCard: AgentCard }> {
  const fromTok = findToken(input.network, input.fromSymbol);
  const toTok = findToken(input.toNetwork, input.toSymbol);
  if (!fromTok || !toTok) throw new AppError("TOKEN_NOT_FOUND");
  const slip = Number(input.slippage);
  if (!Number.isFinite(slip) || slip <= 0) throw new AppError("VALIDATION_ERROR");
  if (slip > 50) throw new AppError("SLIPPAGE_EXCEEDED");
  const raw = parseUnits(input.amount, fromTok.decimals).toString();
  const quote = await getSwapQuote({
    fromAsset: fromTok.address,
    fromAddress: input.address,
    fromDomain: NETWORKS[input.network].domain,
    amount: raw,
    toAsset: toTok.address,
    toAddress: input.address,
    toDomain: NETWORKS[input.toNetwork].domain,
    slippage: String(slip),
  });
  const route = quote.routes![0];
  const step = route.steps?.[0];
  if (!step?.id) throw new AppError("FAILED_QUOTE");
  const outRaw = step.to?.amount ?? "0";
  const minRaw = step.to?.minAmountOut ?? outRaw;
  const outAmt = humanAmount(outRaw, toTok.decimals);
  const minAmt = humanAmount(minRaw, toTok.decimals);
  const inNum = Number(input.amount);
  const outNum = Number(outAmt);
  const rate = inNum > 0 && Number.isFinite(outNum) ? (outNum / inNum).toPrecision(6) : "—";
  let usdValue: number | null = null;
  if (twakConfigured()) {
    try {
      const tickers = await getTokenPrices([NETWORKS[input.network].assetId]);
      const px = tickers[0]?.price;
      if (px) usdValue = px * inNum;
    } catch {
      usdValue = null;
    }
  }
  const providers = (route.steps ?? []).map((s) => s.provider?.name).filter(Boolean).join(" → ") || "Trust Wallet route";
  const gas = route.steps?.map((s) => (s.networkFee ? `${s.networkFee.amount} ${s.networkFee.asset}` : "")).filter(Boolean).join(" + ") || "Quoted with the route";
  const swap: PendingSwap = {
    kind: "swap",
    fromSymbol: fromTok.symbol,
    toSymbol: toTok.symbol,
    fromAmount: input.amount,
    toAmountEst: outAmt,
    minReceived: minAmt,
    rate: `1 ${fromTok.symbol} ≈ ${rate} ${toTok.symbol}`,
    slippage: `${slip}%`,
    network: input.network,
    toNetwork: input.toNetwork,
    gas,
    route: providers,
    deadline: route.expirationDate ?? null,
    recipient: input.address,
    usdValue,
    highValue: usdValue != null && usdValue >= HIGH_VALUE_USD,
    quoteId: route.id,
    stepId: step.id,
    fromAsset: fromTok.address,
    toAsset: toTok.address,
    fromAmountRaw: raw,
    expiresAt: route.expirationDate ?? null,
    priceImpact: step.priceImpact ?? null,
  };
  const routesCard: AgentCard = {
    type: "routes",
    routes: (quote.routes ?? []).slice(0, 5).map((r) => {
      const s = r.steps?.[0];
      const p = r.steps?.map((x) => x.provider?.name).filter(Boolean).join(" → ") || "Route";
      const out = s?.to?.amount ? humanAmount(s.to.amount, toTok.decimals) : "—";
      const fee = s?.networkFee ? `${s.networkFee.amount} ${s.networkFee.asset}` : "—";
      return { provider: p, output: `${out} ${toTok.symbol}`, fee, impact: s?.priceImpact ? `${s.priceImpact}%` : "—" };
    }),
  };
  return { swap, routesCard };
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: WalletContext,
  bucket: { cards: AgentCard[]; actions: PendingAction[] },
): Promise<string> {
  const network = net(typeof args.network === "string" ? args.network : ctx.network, ctx.network);
  const address = (typeof args.address === "string" && args.address) || ctx.address;

  try {
    if (name === "get_balances") {
      if (!address) return JSON.stringify({ error: "Connect a wallet or enter a watch-only address first." });
      const holdings = await loadHoldings(address, network);
      const totalUsd = holdings.every((h) => h.valueUsd == null)
        ? null
        : holdings.reduce((s, h) => s + (h.valueUsd ?? 0), 0);
      bucket.cards.push({
        type: "balances",
        network: NETWORKS[network].name,
        address,
        totalUsd,
        items: holdings.map((h) => ({ symbol: h.symbol, balance: h.balance, valueUsd: h.valueUsd })),
      });
      return JSON.stringify({
        network: NETWORKS[network].name,
        address,
        totalUsd,
        holdings: holdings.map((h) => ({
          symbol: h.symbol,
          balance: h.balance,
          usd: h.valueUsd,
        })),
      });
    }

    if (name === "get_token_prices") {
      if (!twakConfigured()) throw new AppError("API_UNAVAILABLE");
      const symbols = Array.isArray(args.symbols) ? args.symbols.map(String) : [];
      const ids: string[] = [];
      const labels: string[] = [];
      for (const s of symbols) {
        if (s.startsWith("c") && /\d/.test(s)) {
          ids.push(s);
          labels.push(s);
          continue;
        }
        const tok = findToken(network, s) ?? nativeToken(network);
        const id = assetIdForToken(NETWORKS[network], tok.native ? null : tok.address);
        ids.push(id);
        labels.push(tok.symbol);
      }
      const tickers = await getTokenPrices(ids);
      bucket.cards.push({
        type: "price",
        items: tickers.map((t, i) => ({
          symbol: labels[i] ?? t.id,
          assetId: t.id,
          price: t.price,
          change24h: t.change_24h,
        })),
      });
      return JSON.stringify(tickers);
    }

    if (name === "search_tokens") {
      if (!twakConfigured()) throw new AppError("API_UNAVAILABLE");
      const query = String(args.query ?? "");
      const coin = NETWORKS[network].coinId;
      const res = await searchAssets(query, String(coin));
      bucket.cards.push({
        type: "tokens",
        items: res.docs.slice(0, 8).map((d) => ({
          name: d.name,
          symbol: d.symbol,
          assetId: d.asset_id,
          price: d.price,
        })),
      });
      return JSON.stringify(res.docs.slice(0, 8));
    }

    if (name === "get_swap_quote" || name === "propose_swap") {
      if (!address) return JSON.stringify({ error: "An address is required to quote a swap." });
      const fromSymbol = String(args.fromSymbol ?? "");
      const toSymbol = String(args.toSymbol ?? "");
      const amount = String(args.amount ?? "");
      const toNetwork = net(typeof args.toNetwork === "string" ? args.toNetwork : network, network);
      const slippage = String(args.slippage ?? "1");
      const { swap, routesCard } = await buildSwap({
        fromSymbol,
        toSymbol,
        amount,
        network,
        toNetwork,
        slippage,
        address,
      });
      bucket.cards.push({ type: "quote", swap }, routesCard);
      if (name === "propose_swap") bucket.actions.push(swap);
      return JSON.stringify({
        proposed: name === "propose_swap",
        ...swap,
        watchOnly: ctx.watchOnly,
      });
    }

    if (name === "propose_send") {
      if (!address) return JSON.stringify({ error: "Connect a wallet or watch an address first." });
      const tokenSym = String(args.token ?? "");
      const amount = String(args.amount ?? "");
      const destIn = String(args.to ?? "");
      const resolved = destIn.includes(".") ? await resolveEns(destIn) : destIn;
      if (NETWORKS[network].kind !== "evm") {
        return JSON.stringify({
          error:
            "This assistant can quote Solana, but native SOL transfers must be signed in Trust Wallet. EVM send is available on Ethereum, BNB Smart Chain, and the other EVM networks listed.",
        });
      }
      const est = await estimateEvmTransfer({
        from: address,
        to: resolved,
        amount,
        networkKey: network,
        tokenSymbol: tokenSym,
      });
      let usdValue: number | null = null;
      if (twakConfigured() && est.token) {
        try {
          const id = assetIdForToken(NETWORKS[network], est.token.native ? null : est.token.address);
          const tickers = await getTokenPrices([id]);
          if (tickers[0]?.price) usdValue = tickers[0].price * Number(amount);
        } catch {
          usdValue = null;
        }
      }
      const send: PendingSend = {
        kind: "send",
        token: est.token?.symbol ?? tokenSym,
        amount,
        to: destIn,
        toResolved: resolved,
        network,
        fee: `${est.feeNative} ${NETWORKS[network].symbol}`,
        total: est.token?.native ? `${Number(amount) + Number(est.feeNative)} ${est.token.symbol}` : `${amount} ${est.token?.symbol}`,
        usdValue,
        highValue: usdValue != null && usdValue >= HIGH_VALUE_USD,
        tokenAddress: est.token?.address ?? "",
        native: Boolean(est.token?.native),
        data: est.data,
        valueHex: `0x${est.value.toString(16)}`,
        gas: est.gasLimit,
        decimals: est.token?.decimals ?? 18,
      };
      bucket.actions.push(send);
      return JSON.stringify({ ...send, watchOnly: ctx.watchOnly });
    }

    if (name === "validate_destination") {
      const dest = String(args.address ?? "");
      const resolved = dest.includes(".") ? await resolveEns(dest) : dest;
      if (twakConfigured()) {
        const v = await validateAddress(resolved, NETWORKS[network].assetId);
        bucket.cards.push({
          type: "security",
          summary: v.valid === false ? "Address failed validation." : `Result: ${v.result ?? "unknown"}`,
          level: v.details?.is_sanctioned ? "critical" : v.result,
        });
        return JSON.stringify({ resolved, ...v });
      }
      return JSON.stringify({ resolved, valid: true, result: "local-format-only" });
    }

    if (name === "check_token_security") {
      if (!twakConfigured()) throw new AppError("API_UNAVAILABLE");
      const q = String(args.symbolOrAssetId ?? "");
      const tok = findToken(network, q);
      const assetId = q.startsWith("c") ? q : assetIdForToken(NETWORKS[network], tok?.native ? null : tok?.address);
      const info = await checkTokenSecurity(assetId);
      bucket.cards.push({
        type: "security",
        summary: JSON.stringify(info).slice(0, 400),
      });
      return JSON.stringify(info);
    }

    if (name === "get_tx_status") {
      const hash = String(args.hash ?? "");
      const st = await getTxReceipt(network, hash);
      bucket.cards.push({ type: "tx", hash, status: st.status, network: NETWORKS[network].name });
      return JSON.stringify(st);
    }

    if (name === "get_trending") {
      if (!twakConfigured()) throw new AppError("API_UNAVAILABLE");
      const category = String(args.category ?? "trending");
      const res = await getTrending(category, 10);
      bucket.cards.push({
        type: "tokens",
        items: res.docs.slice(0, 10).map((d) => ({
          name: d.asset?.name ?? "",
          symbol: d.asset?.symbol ?? "",
          assetId: d.asset?.asset_id ?? "",
          price: d.price?.price,
        })),
      });
      return JSON.stringify(res.docs.slice(0, 10));
    }

    return JSON.stringify({ error: `Unknown tool ${name}` });
  } catch (error) {
    const mapped = error instanceof AppError ? { code: error.code, message: error.message } : plainError(error);
    return JSON.stringify({ error: mapped.message, errorCode: mapped.code });
  }
}

function contextBlock(ctx: WalletContext): string {
  return [
    `Wallet connected: ${ctx.connected ? "yes" : "no"}`,
    `Watch-only: ${ctx.watchOnly ? "yes" : "no"}`,
    `Address: ${ctx.address ?? "(none)"}`,
    `Network: ${ctx.network} (${ctx.nativeSymbol})`,
    `Native balance snapshot: ${ctx.nativeBalance ?? "unknown"}`,
    `Wallet label: ${ctx.walletLabel ?? "none"}`,
    `Trust Wallet market API: ${twakConfigured() ? "available" : "not configured — prices/swaps/search will fail until server credentials exist"}`,
  ].join("\n");
}

export async function runAgent(input: {
  messages: ClientMessage[];
  wallet: WalletContext;
}): Promise<AgentResult> {
  const apiKey = getXaiApiKey();
  if (!apiKey) {
    return { ok: false, code: "API_UNAVAILABLE", message: "AI is not available in this environment." };
  }

  const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
  if (lastUser && looksLikeSecret(lastUser.content)) {
    return {
      ok: true,
      payload: {
        text: "That looks like a recovery phrase or private key. It was not sent to the model. Use Secure Phrase Check — it never leaves this device.",
        cards: [],
        actions: [],
      },
    };
  }

  const grokMessages: GrokMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: contextBlock(input.wallet) },
    ...input.messages.slice(-16).map((m) => ({ role: m.role, content: m.content })),
  ];

  const bucket = { cards: [] as AgentCard[], actions: [] as PendingAction[] };

  try {
    for (let round = 0; round < 5; round++) {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: grokMessages,
          tools,
          tool_choice: "auto",
          temperature: 0.2,
          max_tokens: 900,
        }),
      });
      if (!res.ok) {
        return { ok: false, code: "RPC_ERROR", message: `The assistant could not be reached (${res.status}).` };
      }
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] }; finish_reason?: string }>;
      };
      const msg = body.choices?.[0]?.message;
      if (!msg) return { ok: false, code: "UNKNOWN", message: "The assistant returned an empty reply." };

      if (msg.tool_calls?.length) {
        grokMessages.push({
          role: "assistant",
          content: msg.content ?? null,
          tool_calls: msg.tool_calls,
        });
        for (const call of msg.tool_calls) {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
          } catch {
            parsed = {};
          }
          const result = await executeTool(call.function.name, parsed, input.wallet, bucket);
          grokMessages.push({ role: "tool", tool_call_id: call.id, content: result });
        }
        continue;
      }

      const payload: AssistantPayload = {
        text: (msg.content ?? "").trim() || "Done.",
        cards: bucket.cards,
        actions: bucket.actions,
      };
      return { ok: true, payload };
    }
    return {
      ok: true,
      payload: {
        text: "I collected the data but needed too many steps. Open the cards below — confirm if you want to proceed.",
        cards: bucket.cards,
        actions: bucket.actions,
      },
    };
  } catch (error) {
    const mapped = plainError(error);
    return { ok: false, code: mapped.code, message: mapped.message };
  }
}
