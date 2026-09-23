import { createHmac, randomUUID } from "node:crypto";
import { getTwakAccessId, getTwakHmacSecret } from "@/lib/env.server";
import { AppError } from "@/lib/wallet/errors";
import { mapTwakHttpError } from "./errors";

const BASE = "https://tws.trustwallet.com";

export function twakConfigured(): boolean {
  return Boolean(getTwakAccessId() && getTwakHmacSecret());
}

function sortedQuery(query: Record<string, string>): string {
  return Object.keys(query)
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join("&");
}

export async function twakFetch<T>(opts: {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}): Promise<T> {
  const accessId = getTwakAccessId();
  const secret = getTwakHmacSecret();
  if (!accessId || !secret) {
    throw new AppError("API_UNAVAILABLE");
  }

  const q: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v === undefined) continue;
    q[k] = String(v);
  }
  const sigQuery = sortedQuery(q);
  const nonce = randomUUID();
  const date = new Date().toUTCString();
  const plaintext = [opts.method, opts.path, sigQuery, accessId, nonce, date].join(";");
  const signature = createHmac("sha256", secret).update(plaintext).digest("base64");

  const url = new URL(opts.path, BASE);
  for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    method: opts.method,
    headers: {
      "Content-Type": "application/json",
      "X-TW-CREDENTIAL": accessId,
      "X-TW-NONCE": nonce,
      "X-TW-DATE": date,
      Authorization: `HMAC-SHA256 Signature=${signature}`,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  const text = await res.text();
  if (!res.ok) throw mapTwakHttpError(res.status, text);
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppError("RPC_ERROR", "Trust Wallet returned a response that could not be read.");
  }
}
