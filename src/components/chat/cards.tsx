import type { AgentCard, PendingAction } from "@/lib/agent/types";
import { formatAmount, formatUsd, shortAddress } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/lib/wallet/store";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium tabular-nums text-fg">{value}</span>
    </div>
  );
}

export function ActionDetails({ action }: { action: PendingAction }) {
  if (action.kind === "swap") {
    return (
      <div className="divide-y divide-border">
        <Row label="You send" value={`${action.fromAmount} ${action.fromSymbol}`} />
        <Row label="You receive (est.)" value={`~ ${formatAmount(action.toAmountEst)} ${action.toSymbol}`} />
        <Row label="Minimum received" value={`${formatAmount(action.minReceived)} ${action.toSymbol}`} />
        <Row label="Rate" value={action.rate} />
        <Row label="Slippage" value={action.slippage} />
        <Row label="Network" value={action.network === action.toNetwork ? action.network : `${action.network} → ${action.toNetwork}`} />
        <Row label="Network fee" value={action.gas} />
        <Row label="Route" value={action.route} />
        <Row label="Recipient" value={shortAddress(action.recipient, 6)} />
        {action.deadline ? <Row label="Quote expires" value={new Date(action.deadline).toLocaleTimeString()} /> : null}
        {action.usdValue != null ? <Row label="Approx. value" value={formatUsd(action.usdValue)} /> : null}
      </div>
    );
  }
  return (
    <div className="divide-y divide-border">
      <Row label="Token" value={action.token} />
      <Row label="Amount" value={`${action.amount} ${action.token}`} />
      <Row label="To" value={shortAddress(action.toResolved, 6)} />
      <Row label="Network" value={action.network} />
      <Row label="Estimated fee" value={action.fee} />
      <Row label="Total" value={action.total} />
      {action.usdValue != null ? <Row label="Approx. value" value={formatUsd(action.usdValue)} /> : null}
    </div>
  );
}

export function AgentCards({ cards, actions }: { cards?: AgentCard[]; actions?: PendingAction[] }) {
  const setPending = useWalletStore((s) => s.setPending);
  return (
    <div className="mt-3 grid gap-2">
      {cards?.map((card, i) => {
        if (card.type === "balances") {
          return (
            <div key={i} className="rounded-lg bg-surface-2 p-3 ring-1 ring-border">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">{card.network}</p>
                <p className="text-sm font-semibold tabular-nums">{formatUsd(card.totalUsd)}</p>
              </div>
              <ul className="mt-2 grid gap-1.5">
                {card.items.map((item) => (
                  <li key={item.symbol} className="flex justify-between text-sm">
                    <span>{item.symbol}</span>
                    <span className="tabular-nums text-muted">
                      {formatAmount(item.balance)}
                      {item.valueUsd != null ? ` · ${formatUsd(item.valueUsd)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        if (card.type === "price") {
          return (
            <div key={i} className="rounded-lg bg-surface-2 p-3 ring-1 ring-border">
              {card.items.map((item) => (
                <div key={item.assetId} className="flex justify-between py-1 text-sm">
                  <span>{item.symbol}</span>
                  <span className="tabular-nums">
                    {formatUsd(item.price)}
                    {item.change24h != null ? (
                      <span className={item.change24h >= 0 ? "text-ok" : "text-danger"}>
                        {" "}
                        {item.change24h >= 0 ? "+" : ""}
                        {item.change24h.toFixed(2)}%
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          );
        }
        if (card.type === "quote") {
          return (
            <div key={i} className="rounded-lg bg-surface-2 p-3 ring-1 ring-border">
              <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Swap quote</p>
              <ActionDetails action={card.swap} />
            </div>
          );
        }
        if (card.type === "routes") {
          return (
            <div key={i} className="rounded-lg bg-surface-2 p-3 ring-1 ring-border">
              <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Routes</p>
              <ul className="grid gap-2">
                {card.routes.map((r, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3 text-sm">
                    <span>{r.provider}</span>
                    <span className="text-right tabular-nums text-muted">
                      {r.output}
                      <span className="block text-xs">fee {r.fee}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        if (card.type === "tx") {
          return (
            <div key={i} className="rounded-lg bg-surface-2 p-3 ring-1 ring-border text-sm">
              <Badge tone={card.status === "confirmed" ? "ok" : card.status === "failed" ? "danger" : "warn"}>
                {card.status}
              </Badge>
              <p className="mt-2 font-mono text-xs break-all">{card.hash}</p>
            </div>
          );
        }
        if (card.type === "tokens") {
          return (
            <div key={i} className="rounded-lg bg-surface-2 p-3 ring-1 ring-border">
              {card.items.map((t) => (
                <div key={t.assetId} className="flex justify-between py-1 text-sm">
                  <span>
                    {t.name} <span className="text-muted">{t.symbol}</span>
                  </span>
                  <span className="tabular-nums">{t.price != null ? formatUsd(t.price) : "—"}</span>
                </div>
              ))}
            </div>
          );
        }
        if (card.type === "security") {
          return (
            <div key={i} className="rounded-lg bg-surface-2 p-3 text-sm text-pretty ring-1 ring-border">
              {card.summary}
            </div>
          );
        }
        return null;
      })}
      {actions?.map((action, i) => (
        <div key={`a-${i}`} className="rounded-lg bg-surface p-3 ring-1 ring-border-strong">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              {action.kind === "swap" ? "Swap ready to confirm" : "Transfer ready to confirm"}
            </p>
            {action.highValue ? <Badge tone="warn">High value</Badge> : null}
          </div>
          <ActionDetails action={action} />
          <Button className="mt-3 w-full" onClick={() => setPending(action)}>
            Review and confirm
          </Button>
        </div>
      ))}
    </div>
  );
}
