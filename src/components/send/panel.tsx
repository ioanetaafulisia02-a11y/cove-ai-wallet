import { useState } from "react";
import { sendChatMessage } from "@/lib/agent/api";
import { KNOWN_TOKENS } from "@/lib/wallet/tokens";
import { newId, useWalletStore } from "@/lib/wallet/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SendPanel() {
  const network = useWalletStore((s) => s.network);
  const address = useWalletStore((s) => s.address);
  const addMessage = useWalletStore((s) => s.addMessage);
  const walletContext = useWalletStore((s) => s.walletContext);
  const tokens = KNOWN_TOKENS[network];
  const [token, setToken] = useState(tokens[0]?.symbol ?? "ETH");
  const [amount, setAmount] = useState("0.01");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  async function propose() {
    if (!address) return;
    const prompt = `Send ${amount} ${token} to ${to} on ${network}. Do not sign. Propose the transfer for confirmation.`;
    addMessage({ id: newId(), role: "user", content: prompt, createdAt: Date.now() });
    setBusy(true);
    try {
      const result = await sendChatMessage({
        data: { messages: [...useWalletStore.getState().transcript()], wallet: walletContext() },
      });
      if (!result.ok) {
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-border">
      <p className="text-sm font-medium">Send</p>
      <p className="mt-1 text-xs text-muted">Shows destination, fee, and total before your wallet is asked to sign.</p>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-xs text-muted">
          Amount
          <div className="flex gap-2">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            <select
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="h-11 w-28 rounded-lg bg-surface-2 px-2 text-sm ring-1 ring-border"
            >
              {KNOWN_TOKENS[network].map((t) => (
                <option key={t.symbol}>{t.symbol}</option>
              ))}
            </select>
          </div>
        </label>
        <label className="grid gap-1.5 text-xs text-muted">
          Destination
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x… or name.eth" />
        </label>
        <Button disabled={busy || !to || !address} onClick={() => void propose()}>
          Review transfer
        </Button>
      </div>
    </div>
  );
}
