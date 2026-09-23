import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NetworkSelect } from "@/components/network-select";
import { isHexAddress, looksLikeSolanaAddress, shortAddress } from "@/lib/format";
import { SAMPLE_ADDRESS, useWalletStore } from "@/lib/wallet/store";
import { plainError } from "@/lib/wallet/errors";
import { NETWORKS } from "@/lib/wallet/networks";

export function WalletPanel() {
  const mode = useWalletStore((s) => s.mode);
  const address = useWalletStore((s) => s.address);
  const label = useWalletStore((s) => s.label);
  const network = useWalletStore((s) => s.network);
  const error = useWalletStore((s) => s.error);
  const connect = useWalletStore((s) => s.connect);
  const disconnect = useWalletStore((s) => s.disconnect);
  const watch = useWalletStore((s) => s.watch);
  const setNetwork = useWalletStore((s) => s.setNetwork);
  const marketReady = useWalletStore((s) => s.marketReady);
  const [draft, setDraft] = useState("");

  async function onConnect() {
    try {
      await connect();
      toast.success("Wallet connected. Keys stay in the wallet.");
    } catch (err) {
      toast.error(plainError(err).message);
    }
  }

  function onWatch(value: string) {
    const v = value.trim();
    if (!v) return;
    if (v.includes(".")) {
      watch(v);
      return;
    }
    if (v.includes(".")) {
      watch(v);
      return;
    }
    if (!isHexAddress(v) && !looksLikeSolanaAddress(v)) {
      toast.error("Enter a valid 0x address, Solana address, or ENS name in chat to resolve.");
      return;
    }
    watch(v);
  }

  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-border">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Wallet</p>
          <p className="mt-0.5 text-xs text-muted">Signing never leaves the wallet.</p>
        </div>
        {mode === "connected" ? <Badge tone="ok">Live</Badge> : mode === "watch" ? <Badge tone="steel">Watch</Badge> : <Badge>Off</Badge>}
      </div>
      <div className="mt-3">
        <NetworkSelect value={network} onChange={(k) => void setNetwork(k)} />
      </div>
      {address ? (
        <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-border">
          <p className="text-xs text-muted">{label} · {NETWORKS[network].symbol}</p>
          <p className="mt-0.5 font-mono text-sm">{shortAddress(address, 6)}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted text-pretty">Not connected. Use Trust Wallet’s in-app browser or an injected extension, or watch a public address.</p>
      )}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      <div className="mt-3 grid gap-2">
        {mode === "connected" || mode === "watch" ? (
          <Button variant="secondary" onClick={disconnect}>
            Disconnect
          </Button>
        ) : (
          <Button onClick={() => void onConnect()}>Connect wallet</Button>
        )}
        <div className="flex gap-2">
          <Input
            value={draft}
            placeholder="Watch 0x address"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onWatch(draft);
            }}
          />
          <Button variant="secondary" onClick={() => onWatch(draft)}>
            Watch
          </Button>
        </div>
        <button
          type="button"
          className="text-left text-xs text-steel underline-offset-2 hover:underline"
          onClick={() => watch(SAMPLE_ADDRESS)}
        >
          Watch a public Ethereum address
        </button>
      </div>
      {marketReady === false ? (
        <p className="mt-3 text-xs text-muted text-pretty">
          Trust Wallet market API is not configured on the server. On-chain balances still load; live prices and swap quotes need portal credentials.
        </p>
      ) : null}
    </div>
  );
}
