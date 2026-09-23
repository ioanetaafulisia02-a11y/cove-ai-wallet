import { EVM_NATIVE_ASSET, type NetworkKey } from "./networks";

export type KnownToken = {
  symbol: string;
  name: string;
  decimals: number;
  /** Contract / mint; native tokens use the EVM sentinel or SOL mint. */
  address: string;
  native?: boolean;
};

export const KNOWN_TOKENS: Record<NetworkKey, KnownToken[]> = {
  ethereum: [
    { symbol: "ETH", name: "Ethereum", decimals: 18, address: EVM_NATIVE_ASSET, native: true },
    { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    { symbol: "USDT", name: "Tether USD", decimals: 6, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
    { symbol: "WETH", name: "Wrapped Ether", decimals: 18, address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
    { symbol: "DAI", name: "Dai Stablecoin", decimals: 18, address: "0x6B175474E89094C44Da98b954EedeAC495271d0F" },
    { symbol: "WBTC", name: "Wrapped BTC", decimals: 8, address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" },
  ],
  bsc: [
    { symbol: "BNB", name: "BNB", decimals: 18, address: EVM_NATIVE_ASSET, native: true },
    { symbol: "USDT", name: "Tether USD", decimals: 18, address: "0x55d398326f99059fF775485246999027B3197955" },
    { symbol: "USDC", name: "USD Coin", decimals: 18, address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" },
    { symbol: "WBNB", name: "Wrapped BNB", decimals: 18, address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" },
  ],
  polygon: [
    { symbol: "POL", name: "Polygon", decimals: 18, address: EVM_NATIVE_ASSET, native: true },
    { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
    { symbol: "USDT", name: "Tether USD", decimals: 6, address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
    { symbol: "WETH", name: "Wrapped Ether", decimals: 18, address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619" },
  ],
  arbitrum: [
    { symbol: "ETH", name: "Ether", decimals: 18, address: EVM_NATIVE_ASSET, native: true },
    { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
    { symbol: "USDT", name: "Tether USD", decimals: 6, address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
    { symbol: "WETH", name: "Wrapped Ether", decimals: 18, address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" },
  ],
  optimism: [
    { symbol: "ETH", name: "Ether", decimals: 18, address: EVM_NATIVE_ASSET, native: true },
    { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" },
    { symbol: "USDT", name: "Tether USD", decimals: 6, address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58" },
  ],
  base: [
    { symbol: "ETH", name: "Ether", decimals: 18, address: EVM_NATIVE_ASSET, native: true },
    { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    { symbol: "WETH", name: "Wrapped Ether", decimals: 18, address: "0x4200000000000000000000000000000000000006" },
  ],
  avalanche: [
    { symbol: "AVAX", name: "Avalanche", decimals: 18, address: EVM_NATIVE_ASSET, native: true },
    { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" },
    { symbol: "USDT", name: "Tether USD", decimals: 6, address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7" },
  ],
  solana: [
    { symbol: "SOL", name: "Solana", decimals: 9, address: "So11111111111111111111111111111111111111112", native: true },
    { symbol: "USDC", name: "USD Coin", decimals: 6, address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
    { symbol: "USDT", name: "Tether USD", decimals: 6, address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
  ],
};

export function findToken(network: NetworkKey, symbolOrAddress: string): KnownToken | undefined {
  const q = symbolOrAddress.trim();
  const tokens = KNOWN_TOKENS[network];
  const bySymbol = tokens.find((t) => t.symbol.toLowerCase() === q.toLowerCase());
  if (bySymbol) return bySymbol;
  return tokens.find((t) => t.address.toLowerCase() === q.toLowerCase());
}

export function nativeToken(network: NetworkKey): KnownToken {
  return KNOWN_TOKENS[network].find((t) => t.native) ?? KNOWN_TOKENS[network][0];
}
