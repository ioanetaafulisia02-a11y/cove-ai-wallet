export type NetworkKey =
  | "ethereum"
  | "bsc"
  | "polygon"
  | "arbitrum"
  | "optimism"
  | "base"
  | "avalanche"
  | "solana";

export type NetworkKind = "evm" | "solana";

export type Network = {
  key: NetworkKey;
  name: string;
  kind: NetworkKind;
  chainId: number;
  /** SLIP-44 / Trust Wallet coin id used in asset ids */
  coinId: number;
  assetId: string;
  symbol: string;
  decimals: number;
  /** Amber swap domain id */
  domain: string;
  explorer: string;
  explorerName: string;
  rpcUrl: string;
  nativeSwapAsset: string;
  color: string;
};

/** Native sentinel used by Trust Wallet swap routes on EVM. */
export const EVM_NATIVE_ASSET = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/** Wrapped SOL mint — typical Solana swap native representation. */
export const SOL_NATIVE_MINT = "So11111111111111111111111111111111111111112";

export const NETWORKS: Record<NetworkKey, Network> = {
  ethereum: {
    key: "ethereum",
    name: "Ethereum",
    kind: "evm",
    chainId: 1,
    coinId: 60,
    assetId: "c60",
    symbol: "ETH",
    decimals: 18,
    domain: "ethereum",
    explorer: "https://etherscan.io",
    explorerName: "Etherscan",
    rpcUrl: "https://ethereum.publicnode.com",
    nativeSwapAsset: EVM_NATIVE_ASSET,
    color: "#6d7c8c",
  },
  bsc: {
    key: "bsc",
    name: "BNB Smart Chain",
    kind: "evm",
    chainId: 56,
    coinId: 20000714,
    assetId: "c20000714",
    symbol: "BNB",
    decimals: 18,
    domain: "bsc",
    explorer: "https://bscscan.com",
    explorerName: "BscScan",
    rpcUrl: "https://bsc-dataseed.binance.org",
    nativeSwapAsset: EVM_NATIVE_ASSET,
    color: "#8a8f78",
  },
  polygon: {
    key: "polygon",
    name: "Polygon",
    kind: "evm",
    chainId: 137,
    coinId: 966,
    assetId: "c966",
    symbol: "POL",
    decimals: 18,
    domain: "polygon",
    explorer: "https://polygonscan.com",
    explorerName: "Polygonscan",
    rpcUrl: "https://polygon-rpc.com",
    nativeSwapAsset: EVM_NATIVE_ASSET,
    color: "#6b7a99",
  },
  arbitrum: {
    key: "arbitrum",
    name: "Arbitrum",
    kind: "evm",
    chainId: 42161,
    coinId: 10042221,
    assetId: "c10042221",
    symbol: "ETH",
    decimals: 18,
    domain: "arbitrum",
    explorer: "https://arbiscan.io",
    explorerName: "Arbiscan",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    nativeSwapAsset: EVM_NATIVE_ASSET,
    color: "#6e7d8c",
  },
  optimism: {
    key: "optimism",
    name: "Optimism",
    kind: "evm",
    chainId: 10,
    coinId: 10000070,
    assetId: "c10000070",
    symbol: "ETH",
    decimals: 18,
    domain: "optimism",
    explorer: "https://optimistic.etherscan.io",
    explorerName: "OP Etherscan",
    rpcUrl: "https://mainnet.optimism.io",
    nativeSwapAsset: EVM_NATIVE_ASSET,
    color: "#8b7474",
  },
  base: {
    key: "base",
    name: "Base",
    kind: "evm",
    chainId: 8453,
    coinId: 10008453,
    assetId: "c10008453",
    symbol: "ETH",
    decimals: 18,
    domain: "base",
    explorer: "https://basescan.org",
    explorerName: "Basescan",
    rpcUrl: "https://mainnet.base.org",
    nativeSwapAsset: EVM_NATIVE_ASSET,
    color: "#6d8090",
  },
  avalanche: {
    key: "avalanche",
    name: "Avalanche",
    kind: "evm",
    chainId: 43114,
    coinId: 10009000,
    assetId: "c10009000",
    symbol: "AVAX",
    decimals: 18,
    domain: "avalanche",
    explorer: "https://snowtrace.io",
    explorerName: "Snowtrace",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    nativeSwapAsset: EVM_NATIVE_ASSET,
    color: "#8a7878",
  },
  solana: {
    key: "solana",
    name: "Solana",
    kind: "solana",
    chainId: 0,
    coinId: 501,
    assetId: "c501",
    symbol: "SOL",
    decimals: 9,
    domain: "solana",
    explorer: "https://solscan.io",
    explorerName: "Solscan",
    rpcUrl: "https://api.mainnet-beta.solana.com",
    nativeSwapAsset: SOL_NATIVE_MINT,
    color: "#6e8b82",
  },
};

export const NETWORK_LIST = Object.values(NETWORKS);

export const EVM_NETWORKS = NETWORK_LIST.filter((n) => n.kind === "evm");

export function networkByChainId(chainId: number): Network | undefined {
  return NETWORK_LIST.find((n) => n.kind === "evm" && n.chainId === chainId);
}

export function networkByKey(key: string): Network | undefined {
  return NETWORKS[key as NetworkKey];
}

export function assetIdForToken(network: Network, contract?: string | null): string {
  if (!contract || contract.toLowerCase() === EVM_NATIVE_ASSET.toLowerCase()) {
    return network.assetId;
  }
  return `${network.assetId}_t${contract}`;
}

export function hexChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}
