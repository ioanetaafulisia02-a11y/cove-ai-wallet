import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import {
  ArrowLeftRight,
  History,
  LayoutGrid,
  MessageSquare,
  Shield,
} from "lucide-react";
import { CoveMark } from "@/components/mark";
import { WalletPanel } from "@/components/wallet-panel";
import { Chatbox } from "@/components/chat/chatbox";
import { PortfolioPanel } from "@/components/portfolio/panel";
import { SwapPanel } from "@/components/swap/panel";
import { SendPanel } from "@/components/send/panel";
import { HistoryPanel } from "@/components/tx/history";
import { PhraseChecker } from "@/components/bip39/phrase-checker";
import { ConfirmModal } from "@/components/tx/confirm-modal";
import { getApiStatus } from "@/lib/agent/api";
import { getInjectedEvm } from "@/lib/wallet/injected";
import { networkByChainId } from "@/lib/wallet/networks";
import { useWalletStore } from "@/lib/wallet/store";
import { cn } from "@/lib/utils";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

type Tab = "chat" | "portfolio" | "swap" | "activity" | "phrase";

const TABS: Array<{ id: Tab; label: string; icon: typeof MessageSquare }> = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "portfolio", label: "Portfolio", icon: LayoutGrid },
  { id: "swap", label: "Move", icon: ArrowLeftRight },
  { id: "activity", label: "Activity", icon: History },
  { id: "phrase", label: "Secure", icon: Shield },
];

function ShellInner() {
  const [tab, setTab] = useState<Tab>("chat");
  const setFlags = useWalletStore((s) => s.setFlags);
  const setNetwork = useWalletStore((s) => s.setNetwork);

  useEffect(() => {
    void getApiStatus().then((s) => setFlags({ marketReady: s.twak, aiReady: s.ai }));
  }, [setFlags]);

  useEffect(() => {
    const provider = getInjectedEvm();
    if (!provider?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      if (!accounts?.[0]) useWalletStore.getState().disconnect();
    };
    const onChain = (...args: unknown[]) => {
      const hex = String(args[0] ?? "");
      const id = Number.parseInt(hex, 16);
      const net = networkByChainId(id);
      if (net) void setNetwork(net.key);
    };
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [setNetwork]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CoveMark className="size-7 text-fg" />
            <div>
              <p className="text-sm font-semibold tracking-tight">Cove</p>
              <p className="text-[11px] text-muted">Trust Wallet agent desk</p>
            </div>
          </div>
          <p className="hidden text-xs text-muted sm:block">Keys never leave the wallet. Phrases never leave this device.</p>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-4 px-4 py-4 pb-24 lg:grid-cols-[280px_minmax(0,1fr)_300px] lg:pb-6">
        <aside className="hidden lg:block">
          <div className="sticky top-20 grid gap-3">
            <WalletPanel />
            <p className="px-1 text-[11px] leading-relaxed text-subtle">
              AI proposes. You confirm. The wallet signs. Recovery phrases are blocked in chat.
            </p>
          </div>
        </aside>

        <main className="min-h-[70vh] rounded-xl bg-surface/40 p-3 ring-1 ring-border lg:min-h-[calc(100dvh-7rem)] lg:p-4">
          <div className="mb-3 lg:hidden">
            <WalletPanel />
          </div>
          <div className={cn(tab !== "chat" && "hidden", "min-h-[28rem] lg:min-h-[calc(100dvh-10rem)]")}>
            <Chatbox />
          </div>
          {tab === "portfolio" ? <PortfolioPanel /> : null}
          {tab === "swap" ? (
            <div className="grid gap-3">
              <SwapPanel />
              <SendPanel />
            </div>
          ) : null}
          {tab === "activity" ? <HistoryPanel /> : null}
          {tab === "phrase" ? <PhraseChecker /> : null}
        </main>

        <aside className="hidden lg:grid lg:content-start lg:gap-3">
          {tab === "chat" ? (
            <>
              <PortfolioPanel />
              <SwapPanel />
            </>
          ) : (
            <div className="rounded-xl bg-surface p-4 text-sm text-muted ring-1 ring-border">
              Switch the chat tab to keep quoting while you inspect this panel.
            </div>
          )}
        </aside>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden">
        <ul className="mx-auto flex max-w-lg justify-between">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <li key={t.id} className="flex-1">
                <button
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex h-14 w-full flex-col items-center justify-center gap-1 text-[11px]",
                    active ? "text-fg" : "text-muted",
                  )}
                >
                  <Icon className="size-4" />
                  {t.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mx-auto hidden w-full max-w-6xl px-4 pb-6 lg:flex lg:gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs ring-1 ring-border",
              tab === t.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ConfirmModal />
      <Toaster theme="dark" position="top-center" richColors={false} />
    </div>
  );
}

export function AppShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <ShellInner />
    </QueryClientProvider>
  );
}
