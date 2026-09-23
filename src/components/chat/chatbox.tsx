import { useEffect, useRef, useState } from "react";
import { ArrowUp, Eraser, LoaderCircle } from "lucide-react";
import { sendChatMessage } from "@/lib/agent/api";
import { looksLikeSecret, SECRET_BLOCK_MESSAGE } from "@/lib/agent/secret-guard";
import { newId, useWalletStore } from "@/lib/wallet/store";
import { Button } from "@/components/ui/button";
import { AgentCards } from "./cards";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What's my ETH balance?",
  "Show my BNB balance.",
  "What's the value of my portfolio?",
  "What's the current ETH price?",
  "Show me available swap routes for 0.05 ETH to USDC.",
  "Swap 0.05 ETH for USDC.",
  "Show my recent transactions.",
];

export function Chatbox() {
  const messages = useWalletStore((s) => s.messages);
  const addMessage = useWalletStore((s) => s.addMessage);
  const clearChat = useWalletStore((s) => s.clearChat);
  const transcript = useWalletStore((s) => s.transcript);
  const walletContext = useWalletStore((s) => s.walletContext);
  const address = useWalletStore((s) => s.address);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);

  async function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || busy) return;
    if (looksLikeSecret(trimmed)) {
      addMessage({
        id: newId(),
        role: "assistant",
        content: SECRET_BLOCK_MESSAGE,
        createdAt: Date.now(),
      });
      setText("");
      return;
    }
    addMessage({ id: newId(), role: "user", content: trimmed, createdAt: Date.now() });
    setText("");
    setBusy(true);
    try {
      const history = [...transcript(), { role: "user" as const, content: trimmed }];
      const result = await sendChatMessage({
        data: { messages: history, wallet: walletContext() },
      });
      if (!result.ok) {
        addMessage({
          id: newId(),
          role: "assistant",
          content: result.message,
          createdAt: Date.now(),
        });
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
      addMessage({
        id: newId(),
        role: "assistant",
        content: "The assistant could not be reached. Try again in a moment.",
        createdAt: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-[22rem] flex-col">
      <div className="flex items-center justify-between gap-3 px-1 pb-3">
        <div>
          <p className="text-sm font-medium">Assistant</p>
          <p className="text-xs text-muted">Natural language. Confirm before anything is signed.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted">
          <Eraser />
          Clear
        </Button>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="rounded-xl bg-surface p-5 ring-1 ring-border">
            <p className="text-lg font-medium tracking-tight text-balance">Ask. Review. Sign.</p>
            <p className="mt-2 max-w-prose text-sm text-muted text-pretty">
              {address
                ? "Balances and quotes use your current address. Swaps and sends wait for an explicit confirmation, then your wallet signs."
                : "Connect Trust Wallet or watch a public address, then ask about balances, prices, or a swap quote."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full bg-surface-2 px-3 py-2 text-left text-xs text-fg ring-1 ring-border hover:bg-bg"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((m) => (
          <article
            key={m.id}
            className={cn("max-w-[42rem]", m.role === "user" ? "ml-auto" : "mr-8")}
          >
            <div
              className={cn(
                "rounded-xl px-3.5 py-2.5 text-sm text-pretty",
                m.role === "user" ? "bg-accent text-accent-fg" : "bg-surface ring-1 ring-border",
              )}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === "assistant" ? <AgentCards cards={m.cards} actions={m.actions} /> : null}
            </div>
          </article>
        ))}
        {busy ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <LoaderCircle className="size-4 animate-spin" />
            Thinking
          </div>
        ) : null}
      </div>
      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          rows={1}
          placeholder="Ask about balances, quotes, or a transfer…"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-lg bg-surface-2 px-3 py-2.5 text-sm ring-1 ring-border placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send">
          <ArrowUp />
        </Button>
      </form>
    </div>
  );
}
