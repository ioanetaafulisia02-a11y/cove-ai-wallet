import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import {
  arbitrum,
  avalanche,
  base,
  bsc,
  mainnet,
  optimism,
  polygon,
} from "viem/chains";
import { AppError } from "./errors";
import { NETWORKS, type NetworkKey } from "./networks";
import { KNOWN_TOKENS, findToken, nativeToken } from "./tokens";
import { isHexAddress, looksLikeSolanaAddress } from "@/lib/format";

const CHAINS: Partial<Record<NetworkKey, Chain>> = {
  ethereum: mainnet,
  bsc,
  polygon,
  arbitrum,
  optimism,
  base,
  avalanche,
};

const clientCache = new Map<NetworkKey, ReturnType<typeof createPublicClient>>();

export function evmClient(networkKey: NetworkKey) {
  const network = NETWORKS[networkKey];
  if (network.kind !== "evm") throw new AppError("UNSUPPORTED_NETWORK");
  const chain = CHAINS[networkKey];
  if (!chain) throw new AppError("UNSUPPORTED_NETWORK");
  let client = clientCache.get(networkKey);
  if (!client) {
    client = createPublicClient({
      chain,
      transport: http(network.rpcUrl, { timeout: 12_000 }),
    });
    clientCache.set(networkKey, client);
  }
  return client;
}

export type Holding = {
  symbol: string;
  name: string;
  address: string;
  native: boolean;
  decimals: number;
  balance: string;
  raw: string;
  priceUsd: number | null;
  valueUsd: number | null;
};

export async function readEvmHoldings(address: string, networkKey: NetworkKey): Promise<Holding[]> {
  if (!isHexAddress(address) || !isAddress(address)) throw new AppError("INVALID_ADDRESS");
  const client = evmClient(networkKey);
  const native = nativeToken(networkKey);
  const nativeRaw = await client.getBalance({ address: address as Address });
  const holdings: Holding[] = [
    {
      symbol: native.symbol,
      name: native.name,
      address: native.address,
      native: true,
      decimals: native.decimals,
      balance: formatUnits(nativeRaw, native.decimals),
      raw: nativeRaw.toString(),
      priceUsd: null,
      valueUsd: null,
    },
  ];

  const erc20s = KNOWN_TOKENS[networkKey].filter((t) => !t.native);
  const results = await Promise.allSettled(
    erc20s.map((t) =>
      client.readContract({
        address: t.address as Address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as Address],
      }),
    ),
  );

  results.forEach((res, i) => {
    const token = erc20s[i];
    if (res.status !== "fulfilled") return;
    const raw = res.value as bigint;
    if (raw === 0n) return;
    holdings.push({
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      native: false,
      decimals: token.decimals,
      balance: formatUnits(raw, token.decimals),
      raw: raw.toString(),
      priceUsd: null,
      valueUsd: null,
    });
  });

  return holdings;
}

export async function readSolanaHoldings(address: string): Promise<Holding[]> {
  if (!looksLikeSolanaAddress(address)) throw new AppError("INVALID_ADDRESS");
  const rpc = NETWORKS.solana.rpcUrl;
  const nativeRes = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [address] }),
  });
  if (!nativeRes.ok) throw new AppError("RPC_ERROR");
  const nativeJson = (await nativeRes.json()) as { result?: { value?: number }; error?: unknown };
  if (nativeJson.error) throw new AppError("RPC_ERROR");
  const lamports = BigInt(nativeJson.result?.value ?? 0);
  const holdings: Holding[] = [
    {
      symbol: "SOL",
      name: "Solana",
      address: NETWORKS.solana.nativeSwapAsset,
      native: true,
      decimals: 9,
      balance: formatUnits(lamports, 9),
      raw: lamports.toString(),
      priceUsd: null,
      valueUsd: null,
    },
  ];

  const tokenRes = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "getTokenAccountsByOwner",
      params: [address, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }],
    }),
  });
  if (tokenRes.ok) {
    const tokenJson = (await tokenRes.json()) as {
      result?: {
        value?: Array<{
          account?: {
            data?: {
              parsed?: {
                info?: { mint?: string; tokenAmount?: { uiAmount?: number; amount?: string; decimals?: number } };
              };
            };
          };
        }>;
      };
    };
    const known = new Map(KNOWN_TOKENS.solana.map((t) => [t.address, t]));
    for (const row of tokenJson.result?.value ?? []) {
      const info = row.account?.data?.parsed?.info;
      const mint = info?.mint;
      const amt = info?.tokenAmount;
      if (!mint || !amt || !amt.uiAmount) continue;
      const meta = known.get(mint);
      holdings.push({
        symbol: meta?.symbol ?? mint.slice(0, 4),
        name: meta?.name ?? "Token",
        address: mint,
        native: false,
        decimals: amt.decimals ?? 0,
        balance: String(amt.uiAmount),
        raw: amt.amount ?? "0",
        priceUsd: null,
        valueUsd: null,
      });
    }
  }
  return holdings;
}

export async function estimateEvmTransfer(input: {
  from: string;
  to: string;
  amount: string;
  networkKey: NetworkKey;
  tokenSymbol: string;
}): Promise<{
  feeNative: string;
  feeRaw: string;
  gasLimit: string;
  gasPrice: string;
  data: Hex;
  value: bigint;
  to: Address;
  token: ReturnType<typeof findToken>;
}> {
  const network = NETWORKS[input.networkKey];
  if (network.kind !== "evm") throw new AppError("UNSUPPORTED_NETWORK");
  if (!isAddress(input.from) || !isAddress(input.to)) throw new AppError("INVALID_ADDRESS");
  const token = findToken(input.networkKey, input.tokenSymbol);
  if (!token) throw new AppError("TOKEN_NOT_FOUND");
  const client = evmClient(input.networkKey);
  const amountRaw = parseUnits(input.amount, token.decimals);

  let to = input.to as Address;
  let data: Hex = "0x";
  let value = 0n;
  if (token.native) {
    value = amountRaw;
  } else {
    to = token.address as Address;
    data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [input.to as Address, amountRaw],
    });
  }

  const gasPrice = await client.getGasPrice();
  let gasLimit: bigint;
  try {
    gasLimit = await client.estimateGas({
      account: input.from as Address,
      to,
      data,
      value,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : "";
    if (msg.includes("insufficient")) throw new AppError("INSUFFICIENT_BALANCE");
    throw new AppError("RPC_ERROR");
  }
  const fee = gasLimit * gasPrice;
  return {
    feeNative: formatUnits(fee, network.decimals),
    feeRaw: fee.toString(),
    gasLimit: `0x${gasLimit.toString(16)}`,
    gasPrice: `0x${gasPrice.toString(16)}`,
    data,
    value,
    to,
    token,
  };
}

export async function getTxReceipt(networkKey: NetworkKey, hash: string) {
  const network = NETWORKS[networkKey];
  if (network.kind !== "evm") {
    const res = await fetch(network.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignatureStatuses",
        params: [[hash], { searchTransactionHistory: true }],
      }),
    });
    if (!res.ok) throw new AppError("RPC_ERROR");
    const json = (await res.json()) as {
      result?: { value?: Array<{ confirmationStatus?: string; err?: unknown } | null> };
    };
    const st = json.result?.value?.[0];
    if (!st) return { status: "unknown" as const, confirmed: false, failed: false, hash };
    const failed = Boolean(st.err);
    return {
      status: failed ? ("failed" as const) : ("confirmed" as const),
      confirmed: !failed,
      failed,
      hash,
    };
  }
  const client = evmClient(networkKey);
  const receipt = await client.getTransactionReceipt({ hash: hash as Hex }).catch(() => null);
  if (!receipt) return { status: "pending" as const, confirmed: false, failed: false, hash };
  const failed = receipt.status === "reverted";
  return {
    status: failed ? ("failed" as const) : ("confirmed" as const),
    confirmed: !failed,
    failed,
    hash,
    blockNumber: receipt.blockNumber.toString(),
  };
}

export async function resolveEns(name: string): Promise<string> {
  if (isHexAddress(name)) return name;
  if (!name.includes(".")) throw new AppError("INVALID_ADDRESS");
  const client = evmClient("ethereum");
  const address = await client.getEnsAddress({ name });
  if (!address) throw new AppError("ENS_NOT_FOUND");
  return address;
}
