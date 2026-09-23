import { AppError } from "@/lib/wallet/errors";
import { twakConfigured, twakFetch } from "./http.server";
import type {
  TwListingDoc,
  TwSearchDoc,
  TwStepTx,
  TwSwapQuote,
  TwTicker,
  TwValidate,
} from "./types";

export { twakConfigured };

export async function searchAssets(query: string, networks?: string, limit = 8) {
  const data = await twakFetch<{ total?: number; docs?: TwSearchDoc[] }>({
    method: "GET",
    path: "/v1/search/assets",
    query: { query, networks, limit },
  });
  return { total: data.total ?? 0, docs: data.docs ?? [] };
}

export async function getAssets(assetId: string) {
  return twakFetch<unknown>({
    method: "GET",
    path: "/v1/assets",
    query: { assetId },
  });
}

export async function getTokenPrices(assetIds: string[], currency = "USD") {
  if (assetIds.length === 0) return [] as TwTicker[];
  const data = await twakFetch<{ tickers?: TwTicker[] }>({
    method: "POST",
    path: "/v2/market/tickers",
    body: { currency, assets: assetIds.slice(0, 50) },
  });
  return data.tickers ?? [];
}

export async function getTrending(categoryId = "trending", limit = 12) {
  const data = await twakFetch<{ docs?: TwListingDoc[]; total?: number }>({
    method: "GET",
    path: "/v1/assets/listings",
    query: { version: 27, currency: "USD", category_id: categoryId, limit },
  });
  return { docs: data.docs ?? [], total: data.total ?? 0 };
}

export async function validateAddress(address: string, assetId?: string) {
  return twakFetch<TwValidate>({
    method: "GET",
    path: "/v1/validate",
    query: { address, asset_id: assetId, type: "address" },
  });
}

export async function checkTokenSecurity(assetId: string) {
  return twakFetch<Record<string, unknown>>({
    method: "GET",
    path: `/v2/coinstatus/${encodeURIComponent(assetId)}`,
    query: {
      version: 2,
      include_security_info: true,
      include_solana_security_info: true,
    },
  });
}

export async function getSwapDomains() {
  return twakFetch<unknown>({
    method: "GET",
    path: "/amber-api/v1/domains",
    query: { ton: true },
  });
}

export async function getSwapProviders() {
  return twakFetch<unknown>({
    method: "GET",
    path: "/amber-api/v1/providers",
  });
}

export async function getSwapQuote(input: {
  fromAsset: string;
  fromAddress: string;
  fromDomain: string;
  amount: string;
  toAsset: string;
  toAddress?: string;
  toDomain: string;
  slippage?: string;
}) {
  const data = await twakFetch<TwSwapQuote>({
    method: "POST",
    path: "/amber-api/v1/route",
    body: {
      fromAsset: input.fromAsset,
      fromAddress: input.fromAddress,
      fromDomain: input.fromDomain,
      amount: input.amount,
      toAsset: input.toAsset,
      toAddress: input.toAddress ?? input.fromAddress,
      toDomain: input.toDomain,
      slippage: input.slippage ?? "1",
      sortBy: "outcome",
      contractCall: false,
    },
  });
  if (!data.routes?.length) throw new AppError("NO_ROUTES");
  return data;
}

export async function getSwapStep(stepId: string) {
  return twakFetch<TwStepTx>({
    method: "POST",
    path: "/amber-api/v1/route/step",
    body: { stepId },
  });
}
