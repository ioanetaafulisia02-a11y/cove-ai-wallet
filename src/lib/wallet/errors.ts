export type WalletErrorCode =
  | "WALLET_NOT_FOUND"
  | "USER_REJECTED"
  | "UNSUPPORTED_NETWORK"
  | "UNSUPPORTED_TOKEN"
  | "INVALID_ADDRESS"
  | "INSUFFICIENT_BALANCE"
  | "INSUFFICIENT_GAS"
  | "FAILED_QUOTE"
  | "SLIPPAGE_EXCEEDED"
  | "EXPIRED_QUOTE"
  | "REJECTED_TRANSACTION"
  | "FAILED_TRANSACTION"
  | "NETWORK_CONGESTION"
  | "RPC_ERROR"
  | "API_UNAVAILABLE"
  | "NO_ROUTES"
  | "TOKEN_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "ENS_NOT_FOUND"
  | "WATCH_ONLY"
  | "UNKNOWN";

const PLAIN: Record<WalletErrorCode, string> = {
  WALLET_NOT_FOUND:
    "No wallet was found in this browser. Open Cove inside Trust Wallet, or use a watch-only address to inspect balances.",
  USER_REJECTED: "The request was declined in the wallet. Nothing was signed or sent.",
  UNSUPPORTED_NETWORK: "That network is not available in this assistant.",
  UNSUPPORTED_TOKEN: "That token is not supported on the selected network.",
  INVALID_ADDRESS: "That does not look like a valid wallet address.",
  INSUFFICIENT_BALANCE: "There is not enough of this token to complete the transfer.",
  INSUFFICIENT_GAS: "The wallet does not have enough native token to cover the network fee.",
  FAILED_QUOTE: "A swap quote could not be created for this pair. The route may be unavailable right now.",
  SLIPPAGE_EXCEEDED: "The slippage you asked for is above the 50% safety limit.",
  EXPIRED_QUOTE: "This quote expired. Request a fresh quote before confirming.",
  REJECTED_TRANSACTION: "The wallet rejected the signature. The transaction was not broadcast.",
  FAILED_TRANSACTION: "The transaction was submitted but failed on-chain. No further funds were moved by this assistant.",
  NETWORK_CONGESTION: "The network is congested. Fees may be higher than usual — wait a moment and try again.",
  RPC_ERROR: "The blockchain node did not respond. Check the network and try again.",
  API_UNAVAILABLE:
    "Trust Wallet market data is not configured on this server. On-chain balances and wallet signing still work.",
  NO_ROUTES: "No swap route was found for this pair on the selected network.",
  TOKEN_NOT_FOUND: "That token could not be resolved on this network.",
  VALIDATION_ERROR: "The request could not be understood. Check the amount, token, and network.",
  ENS_NOT_FOUND: "That name could not be resolved to an address.",
  WATCH_ONLY: "This address is watch-only. Connect a wallet to sign or send anything.",
  UNKNOWN: "Something went wrong. Nothing was signed.",
};

export class AppError extends Error {
  code: WalletErrorCode;
  constructor(code: WalletErrorCode, message?: string) {
    super(message ?? PLAIN[code]);
    this.code = code;
    this.name = "AppError";
  }
}

export function plainError(error: unknown): { code: WalletErrorCode; message: string } {
  if (error instanceof AppError) return { code: error.code, message: error.message };
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const lower = raw.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("denied") || lower.includes("4001")) {
    return { code: "REJECTED_TRANSACTION", message: PLAIN.REJECTED_TRANSACTION };
  }
  if (lower.includes("insufficient funds") || lower.includes("insufficient balance")) {
    return { code: "INSUFFICIENT_BALANCE", message: PLAIN.INSUFFICIENT_BALANCE };
  }
  if (lower.includes("gas") && lower.includes("intrinsic")) {
    return { code: "INSUFFICIENT_GAS", message: PLAIN.INSUFFICIENT_GAS };
  }
  if (lower.includes("429") || lower.includes("too many") || lower.includes("congest")) {
    return { code: "NETWORK_CONGESTION", message: PLAIN.NETWORK_CONGESTION };
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("rpc")) {
    return { code: "RPC_ERROR", message: PLAIN.RPC_ERROR };
  }
  return { code: "UNKNOWN", message: PLAIN.UNKNOWN };
}
