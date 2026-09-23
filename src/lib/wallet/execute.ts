import { fetchSwapStep, fetchTxStatus } from "@/lib/agent/api";
import type { PendingAction } from "@/lib/agent/types";
import { AppError } from "./errors";
import { sendEvmTransaction } from "./injected";
import { NETWORKS } from "./networks";

function toHex(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("0x")) return value;
  try {
    return `0x${BigInt(value).toString(16)}`;
  } catch {
    return value;
  }
}

export async function executePending(
  action: PendingAction,
  from: string,
): Promise<{ hash: string }> {
  if (action.kind === "send") {
    if (NETWORKS[action.network].kind !== "evm") {
      throw new AppError("UNSUPPORTED_NETWORK");
    }
    const hash = await sendEvmTransaction({
      from,
      to: action.native ? action.toResolved : action.tokenAddress,
      value: action.valueHex,
      data: action.data,
      gas: action.gas,
      chain: action.network,
    });
    return { hash };
  }

  if (action.expiresAt && Date.now() > Date.parse(action.expiresAt)) {
    throw new AppError("EXPIRED_QUOTE");
  }

  const step = await fetchSwapStep({ data: { stepId: action.stepId } });
  if (!step.ok) {
    throw new AppError(step.code, step.message);
  }
  const evm = step.step.transaction?.evmTx;
  if (!evm?.to) {
    throw new AppError(
      "UNSUPPORTED_NETWORK",
      "This route did not return an EVM transaction. Sign it in Trust Wallet if you continue on a non-EVM chain.",
    );
  }

  if (step.step.revokeApproval?.to) {
    await sendEvmTransaction({
      from,
      to: step.step.revokeApproval.to,
      value: toHex(step.step.revokeApproval.value) ?? "0x0",
      data: step.step.revokeApproval.data,
      gas: toHex(step.step.revokeApproval.gasLimit),
      chain: action.network,
    });
  }
  if (step.step.approve?.to) {
    const approveHash = await sendEvmTransaction({
      from,
      to: step.step.approve.to,
      value: toHex(step.step.approve.value) ?? "0x0",
      data: step.step.approve.data,
      gas: toHex(step.step.approve.gasLimit),
      chain: action.network,
    });
    for (let i = 0; i < 12; i++) {
      const st = await fetchTxStatus({ data: { hash: approveHash, network: action.network } });
      if (st.ok && st.status.confirmed) break;
      if (st.ok && st.status.failed) throw new AppError("FAILED_TRANSACTION");
      await new Promise((r) => setTimeout(r, 2500));
    }
  }

  const hash = await sendEvmTransaction({
    from,
    to: evm.to,
    value: toHex(evm.value) ?? "0x0",
    data: evm.data,
    gas: toHex(evm.gasLimit),
    chain: action.network,
  });
  return { hash };
}
