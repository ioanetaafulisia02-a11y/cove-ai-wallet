export type TwSearchDoc = {
  name: string;
  symbol: string;
  type?: string;
  decimals?: number;
  asset_id: string;
  icon_url?: string;
  price?: number;
  market_cap?: number;
  volume_24h?: number;
  tags?: string[];
  verifiers?: string[];
};

export type TwTicker = {
  id: string;
  price: number;
  change_24h?: number;
  market_cap?: number;
  volume_24h?: number;
};

export type TwSwapStep = {
  id: string;
  type?: string;
  from?: { asset?: string; address?: string; amount?: string };
  to?: { asset?: string; address?: string; amount?: string; minAmountOut?: string };
  slippage?: string;
  priceImpact?: string;
  provider?: { id?: string; name?: string };
  networkFee?: { amount?: string; asset?: string };
};

export type TwSwapRoute = {
  id: string;
  expirationDate?: string;
  steps?: TwSwapStep[];
  warnings?: unknown[];
};

export type TwSwapQuote = {
  routes?: TwSwapRoute[];
  config?: { refreshInterval?: string };
};

export type TwEvmTx = {
  to?: string;
  value?: string;
  data?: string;
  gasLimit?: string;
};

export type TwStepTx = {
  stepId?: string;
  transaction?: {
    domainId?: string;
    type?: string;
    evmTx?: TwEvmTx;
    data?: string;
  };
  approve?: TwEvmTx | null;
  revokeApproval?: TwEvmTx | null;
};

export type TwValidate = {
  valid?: boolean;
  result?: string;
  details?: {
    is_contract?: boolean;
    is_sanctioned?: boolean;
    risk_score?: number;
    labels?: string[];
  };
};

export type TwListingDoc = {
  asset?: {
    asset_id?: string;
    name?: string;
    symbol?: string;
    decimals?: number;
    icon_url?: string;
    is_verified?: boolean;
    network?: number;
  };
  price?: {
    price?: number;
    percent_change_24h?: number;
  };
  market?: { market_cap?: number; volume_24h?: number };
};
