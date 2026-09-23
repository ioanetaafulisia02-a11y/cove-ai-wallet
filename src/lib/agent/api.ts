import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ClientMessage, WalletContext } from "./types";
import type { NetworkKey } from "@/lib/wallet/networks";
import { NETWORKS } from "@/lib/wallet/networks";
import { AppError, plainError } from "@/lib/wallet/errors";

export const sendChatMessage = createServerFn({ method: "POST" })
  .validator((input: { messages: ClientMessage[]; wallet: WalletContext }) => input)
  .handler(async ({ data }) => {
    const { runAgent } = await import("./run.server");
    return runAgent({
      messages: data.messages,
      wallet: data.wallet,
    });
  });

export const getApiStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { twakConfigured } = await import("@/lib/trustwallet/http.server");
  const { getXaiApiKey } = await import("@/lib/env.server");
  return {
    twak: twakConfigured(),
    ai: Boolean(getXaiApiKey()),
  };
});

export const fetchPortfolio = createServerFn({ method: "POST" })
  .validator((input: { address: string; network: NetworkKey }) => input)
  .handler(async ({ data }) => {
    try {
      const { readEvmHoldings, readSolanaHoldings } = await import("@/lib/wallet/onchain.server");
      const { getTokenPrices, twakConfigured } = await import("@/lib/trustwallet/api.server");
      const { assetIdForToken } = await import("@/lib/wallet/networks");
      const network = NETWORKS[data.network];
      const holdings =
        network.kind === "solana"
          ? await readSolanaHoldings(data.address)
          : await readEvmHoldings(data.address, data.network);
      if (twakConfigured()) {
        const ids = holdings.map((h) => assetIdForToken(network, h.native ? null : h.address));
        try {
          const tickers = await getTokenPrices(ids);
          const map = new Map(tickers.map((t) => [t.id, t]));
          for (let i = 0; i < holdings.length; i++) {
            const price = map.get(ids[i])?.price ?? null;
            holdings[i].priceUsd = price;
            holdings[i].valueUsd = price == null ? null : price * Number(holdings[i].balance);
          }
        } catch {
          /* prices optional */
        }
      }
      const totalUsd = holdings.some((h) => h.valueUsd != null)
        ? holdings.reduce((s, h) => s + (h.valueUsd ?? 0), 0)
        : null;
      return { ok: true as const, holdings, totalUsd };
    } catch (error) {
      const mapped = error instanceof AppError ? error : null;
      const p = mapped ? { code: mapped.code, message: mapped.message } : plainError(error);
      return { ok: false as const, ...p };
    }
  });

export const fetchSwapStep = createServerFn({ method: "POST" })
  .validator((input: { stepId: string }) => input)
  .handler(async ({ data }) => {
    try {
      const { getSwapStep } = await import("@/lib/trustwallet/api.server");
      const step = await getSwapStep(data.stepId);
      return { ok: true as const, step };
    } catch (error) {
      const p = error instanceof AppError ? { code: error.code, message: error.message } : plainError(error);
      return { ok: false as const, ...p };
    }
  });

export const fetchTxStatus = createServerFn({ method: "POST" })
  .validator((input: { hash: string; network: NetworkKey }) => input)
  .handler(async ({ data }) => {
    try {
      const { getTxReceipt } = await import("@/lib/wallet/onchain.server");
      const status = await getTxReceipt(data.network, data.hash);
      return { ok: true as const, status };
    } catch (error) {
      const p = error instanceof AppError ? { code: error.code, message: error.message } : plainError(error);
      return { ok: false as const, ...p };
    }
  });

export const fetchPrices = createServerFn({ method: "POST" })
  .validator(z.object({ assetIds: z.array(z.string()) }))
  .handler(async ({ data }) => {
    try {
      const { getTokenPrices, twakConfigured } = await import("@/lib/trustwallet/api.server");
      if (!twakConfigured()) {
        return { ok: false as const, code: "API_UNAVAILABLE" as const, message: "Market data is not configured." };
      }
      const tickers = await getTokenPrices(data.assetIds);
      return { ok: true as const, tickers };
    } catch (error) {
      const p = error instanceof AppError ? { code: error.code, message: error.message } : plainError(error);
      return { ok: false as const, ...p };
    }
  });
