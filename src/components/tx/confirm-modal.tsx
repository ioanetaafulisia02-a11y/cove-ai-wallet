import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionDetails } from "@/components/chat/cards";
import { executePending } from "@/lib/wallet/execute";
import { plainError } from "@/lib/wallet/errors";
import { newId, useWalletStore } from "@/lib/wallet/store";
import { NETWORKS } from "@/lib/wallet/networks";
import { fetchTxStatus } from "@/lib/agent/api";

export function ConfirmModal() {
  const pending = useWalletStore((s) => s.pending);
  const stage = useWalletStore((s) => s.confirmStage);
  const setPending = useWalletStore((s) => s.setPending);
  const setConfirmStage = useWalletStore((s) => s.setConfirmStage);
  const mode = useWalletStore((s) => s.mode);
  const address = useWalletStore((s) => s.address);
  const addHistory = useWalletStore((s) => s.addHistory);
  const patchHistory = useWalletStore((s) => s.patchHistory);
  const addMessage = useWalletStore((s) => s.addMessage);
  const [busy, setBusy] = useState(false);

  const open = Boolean(pending) && stage > 0;

  async function confirm() {
    if (!pending) return;
    if (mode !== "connected" || !address) {
      toast.error("Connect a wallet to sign. Watch-only addresses cannot send.");
      return;
    }
    if (pending.highValue && stage === 1) {
      setConfirmStage(2);
      return;
    }
    setBusy(true);
    const historyId = newId();
    const summary =
      pending.kind === "swap"
        ? `${pending.fromAmount} ${pending.fromSymbol} → ${pending.toSymbol}`
        : `Send ${pending.amount} ${pending.token}`;
    try {
      const { hash } = await executePending(pending, address);
      addHistory({
        id: historyId,
        hash,
        kind: pending.kind,
        summary,
        network: pending.network,
        status: "pending",
        createdAt: Date.now(),
      });
      addMessage({
        id: newId(),
        role: "assistant",
        content: `Submitted. Hash ${hash}. Waiting for confirmation on ${NETWORKS[pending.network].name}.`,
        cards: [{ type: "tx", hash, status: "pending", network: NETWORKS[pending.network].name }],
        createdAt: Date.now(),
      });
      setPending(null);
      toast.success("Sent to your wallet / network.");
      const st = await fetchTxStatus({ data: { hash, network: pending.network } });
      if (st.ok) {
        patchHistory(historyId, {
          status: st.status.failed ? "failed" : st.status.confirmed ? "confirmed" : "pending",
        });
      }
    } catch (error) {
      const mapped = plainError(error);
      toast.error(mapped.message);
      addHistory({
        id: historyId,
        hash: "",
        kind: pending.kind,
        summary,
        network: pending.network,
        status: mapped.code === "REJECTED_TRANSACTION" || mapped.code === "USER_REJECTED" ? "rejected" : "failed",
        createdAt: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && setPending(null)}>
      <DialogContent>
        <DialogTitle>{pending?.kind === "swap" ? "Confirm swap" : "Confirm transfer"}</DialogTitle>
        <DialogDescription>
          Review every field. Cove cannot sign — your wallet will ask you to approve after this step.
        </DialogDescription>
        {pending?.highValue ? (
          <div className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
            High-value transaction (about $1,000+). {stage === 2 ? "Confirm again to continue." : "An extra confirmation is required."}
          </div>
        ) : null}
        {pending ? (
          <div className="mt-4">
            <ActionDetails action={pending} />
          </div>
        ) : null}
        {mode !== "connected" ? (
          <p className="mt-3 text-sm text-muted">Connect Trust Wallet (or another injected wallet) to sign. Nothing will be broadcast from watch-only mode.</p>
        ) : null}
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setPending(null)} disabled={busy}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => void confirm()} disabled={busy}>
            {busy ? "Waiting for wallet…" : stage === 2 ? "Confirm again" : pending?.kind === "swap" ? "Confirm swap" : "Confirm send"}
          </Button>
        </div>
        {pending?.kind === "swap" ? (
          <p className="mt-3 text-xs text-muted">
            Status <Badge>unsigned</Badge> until the wallet popup is approved.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
