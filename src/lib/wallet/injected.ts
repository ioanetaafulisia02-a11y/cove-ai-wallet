import { hexChainId, NETWORKS, type Network, type NetworkKey } from "./networks";
import { AppError } from "./errors";

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isMetaMask?: boolean;
};

export type SolanaProvider = {
  isTrust?: boolean;
  publicKey?: { toString: () => string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect?: () => Promise<void>;
  signAndSendTransaction?: (tx: unknown) => Promise<{ signature: string }>;
};

function win(): Window & {
  ethereum?: Eip1193Provider;
  trustwallet?: { solana?: SolanaProvider; ethereum?: Eip1193Provider };
  solana?: SolanaProvider;
} {
  return window as never;
}

export function getInjectedEvm(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const w = win();
  return w.trustwallet?.ethereum ?? w.ethereum ?? null;
}

export function getInjectedSolana(): SolanaProvider | null {
  if (typeof window === "undefined") return null;
  const w = win();
  return w.trustwallet?.solana ?? w.solana ?? null;
}

export function walletLabel(provider: Eip1193Provider | null): string {
  if (!provider) return "Wallet";
  if (provider.isTrust || provider.isTrustWallet) return "Trust Wallet";
  if (provider.isMetaMask) return "Injected wallet";
  return "Injected wallet";
}

export async function connectEvm(): Promise<{ address: string; chainId: number; label: string }> {
  const provider = getInjectedEvm();
  if (!provider) throw new AppError("WALLET_NOT_FOUND");
  let accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new AppError("WALLET_NOT_FOUND");
  const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
  return {
    address: accounts[0],
    chainId: Number.parseInt(chainHex, 16),
    label: walletLabel(provider),
  };
}

export async function switchEvmChain(network: Network): Promise<void> {
  const provider = getInjectedEvm();
  if (!provider) throw new AppError("WALLET_NOT_FOUND");
  if (network.kind !== "evm") throw new AppError("UNSUPPORTED_NETWORK");
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId(network.chainId) }],
    });
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexChainId(network.chainId),
            chainName: network.name,
            nativeCurrency: { name: network.symbol, symbol: network.symbol, decimals: network.decimals },
            rpcUrls: [network.rpcUrl],
            blockExplorerUrls: [network.explorer],
          },
        ],
      });
      return;
    }
    throw error;
  }
}

export async function sendEvmTransaction(tx: {
  from: string;
  to: string;
  value?: string;
  data?: string;
  gas?: string;
  chain: NetworkKey;
}): Promise<string> {
  const provider = getInjectedEvm();
  if (!provider) throw new AppError("WALLET_NOT_FOUND");
  const network = NETWORKS[tx.chain];
  if (network.kind === "evm") {
    await switchEvmChain(network);
  }
  const hash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: tx.from,
        to: tx.to,
        value: tx.value ?? "0x0",
        data: tx.data ?? "0x",
        ...(tx.gas ? { gas: tx.gas } : {}),
      },
    ],
  })) as string;
  return hash;
}

export async function getEvmBalance(address: string): Promise<bigint> {
  const provider = getInjectedEvm();
  if (!provider) throw new AppError("WALLET_NOT_FOUND");
  const hex = (await provider.request({
    method: "eth_getBalance",
    params: [address, "latest"],
  })) as string;
  return BigInt(hex);
}

export async function connectSolana(): Promise<string> {
  const provider = getInjectedSolana();
  if (!provider) throw new AppError("WALLET_NOT_FOUND");
  const res = await provider.connect();
  return res.publicKey.toString();
}
