import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { explorerTxUrl, shortAddress } from "@/lib/format";
import { NETWORKS } from "@/lib/wallet/networks";
import { useWalletStore } from "@/lib/wallet/store";

export function HistoryPanel() {
  const history = useWalletStore((s) => s.history);
  if (history.length === 0) {
    return (
      <div className="rounded-xl bg-surface p-5 ring-1 ring-border">
        <p className="text-sm font-medium">Activity</p>
        <p className="mt-2 text-sm text-muted text-pretty">
          Transfers and swaps you confirm here appear in this list. Ask the assistant “show the transaction status” with a hash to look up a specific transaction.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-border">
      <p className="text-sm font-medium">Activity</p>
      <ul className="mt-3 divide-y divide-border">
        {history.map((tx) => (
          <li key={tx.id} className="py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">{tx.summary}</p>
              <Badge tone={tx.status === "confirmed" ? "ok" : tx.status === "failed" || tx.status === "rejected" ? "danger" : "warn"}>
                {tx.status}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              {NETWORKS[tx.network].name} · {formatDistanceToNow(tx.createdAt, { addSuffix: true })}
            </p>
            {tx.hash ? (
              <a
                className="mt-1 inline-block font-mono text-xs text-steel underline-offset-2 hover:underline"
                href={explorerTxUrl(NETWORKS[tx.network].explorer, tx.hash)}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddress(tx.hash, 8)}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
