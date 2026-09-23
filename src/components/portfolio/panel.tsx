import { useQuery } from "@tanstack/react-query";
import { fetchPortfolio } from "@/lib/agent/api";
import { formatAmount, formatUsd, shortAddress } from "@/lib/format";
import { NETWORKS } from "@/lib/wallet/networks";
import { useWalletStore } from "@/lib/wallet/store";
import { Badge } from "@/components/ui/badge";

export function PortfolioPanel() {
  const address = useWalletStore((s) => s.address);
  const network = useWalletStore((s) => s.network);
  const mode = useWalletStore((s) => s.mode);
  const nativeBalance = useWalletStore((s) => s.nativeBalance);
  const query = useQuery({
    queryKey: ["portfolio", address, network],
    enabled: Boolean(address),
    queryFn: async () => {
      const res = await fetchPortfolio({ data: { address: address!, network } });
      if (!res.ok) throw new Error(res.message);
      return res;
    },
  });

  if (!address) {
    return (
      <div className="rounded-xl bg-surface p-5 ring-1 ring-border">
        <p className="text-sm font-medium">Portfolio</p>
        <p className="mt-2 text-sm text-muted text-pretty">
          Connect a wallet or watch an address to load native and token balances on {NETWORKS[network].name}.
        </p>
      </div>
    );
  }

  const holdings = query.data?.holdings ?? [];
  const total = query.data?.totalUsd ?? null;

  return (
    <div className="grid gap-3">
      <section className="rounded-xl bg-surface p-4 ring-1 ring-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">{NETWORKS[network].name}</p>
            <p className="mt-2 font-mono text-xs text-muted">{shortAddress(address, 6)}</p>
          </div>
          <Badge tone={mode === "connected" ? "ok" : "steel"}>{mode === "connected" ? "Connected" : "Watch-only"}</Badge>
        </div>
        <p className="mt-4 text-3xl font-medium tracking-tight tabular-nums">{formatUsd(total)}</p>
        <p className="mt-1 text-sm text-muted tabular-nums">
          {nativeBalance
            ? `${formatAmount(nativeBalance)} ${NETWORKS[network].symbol} native (wallet)`
            : query.isLoading
              ? "Loading holdings…"
              : "On-chain holdings below"}
        </p>
      </section>
      <section className="rounded-xl bg-surface p-4 ring-1 ring-border">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Tokens</p>
        {query.isError ? (
          <p className="mt-3 text-sm text-danger">{(query.error as Error).message}</p>
        ) : holdings.length === 0 && !query.isLoading ? (
          <p className="mt-3 text-sm text-muted">No known-token balances on this network.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {holdings.map((h) => (
              <li key={h.address} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{h.symbol}</p>
                  <p className="text-xs text-muted">{h.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums">{formatAmount(h.balance)}</p>
                  <p className="text-xs text-muted tabular-nums">{formatUsd(h.valueUsd)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
