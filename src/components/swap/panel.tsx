import { useState } from "react";
import { sendChatMessage } from "@/lib/agent/api";
import { KNOWN_TOKENS } from "@/lib/wallet/tokens";
import { NETWORKS } from "@/lib/wallet/networks";
import { newId, useWalletStore } from "@/lib/wallet/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SwapPanel() {
  const network = useWalletStore((s) => s.network);
  const address = useWalletStore((s) => s.address);
  const addMessage = useWalletStore((s) => s.addMessage);
  const walletContext = useWalletStore((s) => s.walletContext);
  const tokens = KNOWN_TOKENS[network];
  const [fromSymbol, setFrom] = useState(tokens[0]?.symbol ?? "ETH");
  const [toSymbol, setTo] = useState(tokens[1]?.symbol ?? "USDC");
  const [amount, setAmount] = useState("0.05");
  const [slippage, setSlippage] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromOptions = KNOWN_TOKENS[network];

  async function quote(propose: boolean) {
    if (!address) {
      setError("Connect a wallet or watch an address first.");
      return;
    }
    setBusy(true);
    setError(null);
    const prompt = propose
      ? `Swap ${amount} ${fromSymbol} for ${toSymbol} on ${network} with ${slippage}% slippage.`
      : `Show me available swap routes for ${amount} ${fromSymbol} to ${toSymbol} on ${network} with ${slippage}% slippage. Quote only.`;
    addMessage({ id: newId(), role: "user", content: prompt, createdAt: Date.now() });
    try {
      const result = await sendChatMessage({
        data: { messages: [...useWalletStore.getState().transcript()], wallet: walletContext() },
      });
      if (!result.ok) {
        setError(result.message);
        addMessage({ id: newId(), role: "assistant", content: result.message, createdAt: Date.now() });
        return;
      }
      addMessage({
        id: newId(),
        role: "assistant",
        content: result.payload.text,
        cards: result.payload.cards,
        actions: result.payload.actions,
        createdAt: Date.now(),
      });
    } catch {
      setError("Quote failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-border">
      <p className="text-sm font-medium">Swap</p>
      <p className="mt-1 text-xs text-muted text-pretty">
        Quotes come from Trust Wallet routing. Nothing is signed until you confirm twice for high-value trades.
      </p>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-xs text-muted">
          You send
          <div className="flex gap-2">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            <select
              value={fromSymbol}
              onChange={(e) => setFrom(e.target.value)}
              className="h-11 w-28 rounded-lg bg-surface-2 px-2 text-sm text-fg ring-1 ring-border"
            >
              {fromOptions.map((t) => (
                <option key={t.symbol}>{t.symbol}</option>
              ))}
            </select>
          </div>
        </label>
        <label className="grid gap-1.5 text-xs text-muted">
          You receive
          <select
            value={toSymbol}
            onChange={(e) => setTo(e.target.value)}
            className="h-11 rounded-lg bg-surface-2 px-3 text-sm text-fg ring-1 ring-border"
          >
            {fromOptions.map((t) => (
              <option key={t.symbol}>{t.symbol}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs text-muted">
          Slippage %
          <Input value={slippage} onChange={(e) => setSlippage(e.target.value)} inputMode="decimal" />
        </label>
        <p className="text-xs text-muted">Network: {NETWORKS[network].name}</p>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => void quote(false)}>
            Routes
          </Button>
          <Button disabled={busy} onClick={() => void quote(true)}>
            Quote to confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
