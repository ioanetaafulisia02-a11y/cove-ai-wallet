import { create } from "zustand";
import type { NetworkKey } from "./networks";
import { NETWORKS, networkByChainId } from "./networks";
import { AppError } from "./errors";
import {
  connectEvm,
  connectSolana,
  getEvmBalance,
  getInjectedEvm,
  switchEvmChain,
} from "./injected";
import { formatUnits } from "viem";
import type { AgentCard, ClientMessage, PendingAction } from "@/lib/agent/types";

export type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards?: AgentCard[];
  actions?: PendingAction[];
  createdAt: number;
};

export type HistoryTx = {
  id: string;
  hash: string;
  kind: "swap" | "send";
  summary: string;
  network: NetworkKey;
  status: "pending" | "confirmed" | "failed" | "rejected";
  createdAt: number;
};

export type WalletMode = "disconnected" | "connecting" | "connected" | "watch";

type State = {
  mode: WalletMode;
  address: string | null;
  network: NetworkKey;
  chainId: number | null;
  label: string | null;
  nativeBalance: string | null;
  error: string | null;
  messages: ChatEntry[];
  pending: PendingAction | null;
  confirmStage: 0 | 1 | 2;
  history: HistoryTx[];
  marketReady: boolean | null;
  aiReady: boolean | null;
};

type Actions = {
  connect: () => Promise<void>;
  disconnect: () => void;
  watch: (address: string) => void;
  setNetwork: (key: NetworkKey) => Promise<void>;
  refreshNative: () => Promise<void>;
  addMessage: (entry: ChatEntry) => void;
  clearChat: () => void;
  setPending: (action: PendingAction | null) => void;
  setConfirmStage: (stage: 0 | 1 | 2) => void;
  addHistory: (tx: HistoryTx) => void;
  patchHistory: (id: string, patch: Partial<HistoryTx>) => void;
  setFlags: (flags: { marketReady?: boolean; aiReady?: boolean }) => void;
  transcript: () => ClientMessage[];
  walletContext: () => {
    connected: boolean;
    watchOnly: boolean;
    address: string | null;
    network: NetworkKey;
    nativeSymbol: string;
    nativeBalance: string | null;
    walletLabel: string | null;
  };
};

export const SAMPLE_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

export const useWalletStore = create<State & Actions>()((set, get) => ({
  mode: "disconnected",
  address: null,
  network: "ethereum",
  chainId: 1,
  label: null,
  nativeBalance: null,
  error: null,
  messages: [],
  pending: null,
  confirmStage: 0,
  history: [],
  marketReady: null,
  aiReady: null,

  connect: async () => {
    set({ mode: "connecting", error: null });
    try {
      const network = NETWORKS[get().network];
      if (network.kind === "solana") {
        const address = await connectSolana();
        set({
          mode: "connected",
          address,
          label: "Solana wallet",
          chainId: null,
        });
        return;
      }
      const evm = await connectEvm();
      const matched = networkByChainId(evm.chainId);
      set({
        mode: "connected",
        address: evm.address,
        chainId: evm.chainId,
        label: evm.label,
        network: matched?.key ?? get().network,
      });
      await get().refreshNative();
    } catch (error) {
      const message = error instanceof AppError ? error.message : "Could not connect the wallet.";
      set({ mode: "disconnected", error: message });
      throw error;
    }
  },

  disconnect: () => {
    set({
      mode: "disconnected",
      address: null,
      label: null,
      nativeBalance: null,
      chainId: null,
      error: null,
    });
  },

  watch: (address: string) => {
    set({
      mode: "watch",
      address: address.trim(),
      label: "Watch-only",
      nativeBalance: null,
      error: null,
    });
  },

  setNetwork: async (key) => {
    const network = NETWORKS[key];
    set({ network: key, error: null });
    if (get().mode === "connected" && network.kind === "evm") {
      try {
        await switchEvmChain(network);
        set({ chainId: network.chainId });
      } catch {
        set({ error: "The wallet did not switch networks. You can still inspect this chain as watch-only." });
      }
    }
    await get().refreshNative();
  },

  refreshNative: async () => {
    const { address, network, mode } = get();
    if (!address) return;
    try {
      if (NETWORKS[network].kind === "evm" && mode === "connected" && getInjectedEvm()) {
        const raw = await getEvmBalance(address);
        set({ nativeBalance: formatUnits(raw, NETWORKS[network].decimals) });
      }
    } catch {
      /* ignore */
    }
  },

  addMessage: (entry) => set({ messages: [...get().messages, entry].slice(-80) }),
  clearChat: () => set({ messages: [], pending: null, confirmStage: 0 }),
  setPending: (action) => set({ pending: action, confirmStage: action ? 1 : 0 }),
  setConfirmStage: (stage) => set({ confirmStage: stage }),
  addHistory: (tx) => set({ history: [tx, ...get().history].slice(0, 50) }),
  patchHistory: (id, patch) =>
    set({
      history: get().history.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }),
  setFlags: (flags) => set(flags),
  transcript: () => get().messages.map((m) => ({ role: m.role, content: m.content })),
  walletContext: () => {
    const s = get();
    return {
      connected: s.mode === "connected",
      watchOnly: s.mode === "watch",
      address: s.address,
      network: s.network,
      nativeSymbol: NETWORKS[s.network].symbol,
      nativeBalance: s.nativeBalance,
      walletLabel: s.label,
    };
  },
}));

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
