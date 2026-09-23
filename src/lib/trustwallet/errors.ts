import { AppError, type WalletErrorCode } from "@/lib/wallet/errors";

export function mapTwakHttpError(status: number, body: string): AppError {
  let code: WalletErrorCode = "UNKNOWN";
  if (status === 401 || status === 403) code = "API_UNAVAILABLE";
  else if (status === 404) code = "TOKEN_NOT_FOUND";
  else if (status === 429) code = "NETWORK_CONGESTION";
  else if (status >= 500) code = "RPC_ERROR";
  else if (status >= 400) code = "VALIDATION_ERROR";

  let detail = "";
  try {
    const parsed = JSON.parse(body) as { error?: string; message?: string; errorCode?: string };
    detail = parsed.error || parsed.message || "";
    const mapped = parsed.errorCode?.toUpperCase();
    if (mapped === "NO_ROUTES") code = "NO_ROUTES";
    if (mapped === "TOKEN_NOT_FOUND") code = "TOKEN_NOT_FOUND";
    if (mapped === "SLIPPAGE_EXCEEDED") code = "SLIPPAGE_EXCEEDED";
    if (mapped === "CHAIN_UNSUPPORTED") code = "UNSUPPORTED_NETWORK";
  } catch {
    /* ignore */
  }
  const base = new AppError(code);
  return new AppError(code, detail ? `${base.message} (${detail})` : base.message);
}
