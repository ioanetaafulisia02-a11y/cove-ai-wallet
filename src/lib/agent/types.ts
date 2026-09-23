import type { NetworkKey } from "@/lib/wallet/networks";
import type { WalletErrorCode } from "@/lib/wallet/errors";

export type WalletContext = {
  connected: boolean;
  watchOnly: boolean;
  address: string | null;
  network: NetworkKey;
  nativeSymbol: string;
  nativeBalance: string | null;
  walletLabel: string | null;
};

export type PendingSwap = {
  kind: "swap";
  fromSymbol: string;
  toSymbol: string;
  fromAmount: string;
  toAmountEst: string;
  minReceived: string;
  rate: string;
  slippage: string;
  network: NetworkKey;
  toNetwork: NetworkKey;
  gas: string;
  route: string;
  deadline: string | null;
  recipient: string;
  usdValue: number | null;
  highValue: boolean;
  quoteId: string;
  stepId: string;
  fromAsset: string;
  toAsset: string;
  fromAmountRaw: string;
  expiresAt: string | null;
  priceImpact: string | null;
};

export type PendingSend = {
  kind: "send";
  token: string;
  amount: string;
  to: string;
  toResolved: string;
  network: NetworkKey;
  fee: string;
  total: string;
  usdValue: number | null;
  highValue: boolean;
  tokenAddress: string;
  native: boolean;
  data: string;
  valueHex: string;
  gas: string;
  decimals: number;
};

export type PendingAction = PendingSwap | PendingSend;

export type AgentCard =
  | {
      type: "balances";
      network: string;
      address: string;
      totalUsd: number | null;
      items: Array<{ symbol: string; balance: string; valueUsd: number | null }>;
    }
  | {
      type: "price";
      items: Array<{ symbol: string; assetId: string; price: number; change24h?: number }>;
    }
  | {
      type: "quote";
      swap: PendingSwap;
    }
  | {
      type: "routes";
      routes: Array<{ provider: string; output: string; fee: string; impact: string }>;
    }
  | {
      type: "tx";
      hash: string;
      status: string;
      network: string;
    }
  | {
      type: "tokens";
      items: Array<{ name: string; symbol: string; assetId: string; price?: number }>;
    }
  | {
      type: "security";
      summary: string;
      level?: string;
    };

export type ChatRole = "user" | "assistant";

export type ClientMessage = {
  role: ChatRole;
  content: string;
};

export type AssistantPayload = {
  text: string;
  cards: AgentCard[];
  actions: PendingAction[];
};

export type AgentResult =
  | { ok: true; payload: AssistantPayload }
  | { ok: false; code: WalletErrorCode; message: string };
