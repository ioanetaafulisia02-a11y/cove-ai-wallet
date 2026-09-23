import { useMemo, useState } from "react";
import { inspectPhrase } from "@/lib/bip39/checker";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function PhraseChecker() {
  const [value, setValue] = useState("");
  const report = useMemo(() => inspectPhrase(value), [value]);

  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-border">
      <p className="text-sm font-medium">Secure Phrase Check</p>
      <p className="mt-1 text-xs text-muted text-pretty">
        Runs only in this browser. Words are never sent to the assistant, a server, or Trust Wallet. Do not paste a phrase into chat.
      </p>
      <Textarea
        className="mt-4 font-mono"
        value={value}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Type or paste 12–24 words locally…"
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        type="button"
        className="mt-2 text-xs text-muted underline-offset-2 hover:underline"
        onClick={() => setValue("")}
      >
        Clear this device
      </button>
      {value.trim() ? (
        <div className="mt-4 grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone={report.countOk ? "ok" : "warn"}>{report.count} words</Badge>
            {report.checksumOk === true ? <Badge tone="ok">Checksum valid</Badge> : null}
            {report.checksumOk === false ? <Badge tone="danger">Checksum invalid</Badge> : null}
            {report.unknown.length ? <Badge tone="danger">{report.unknown.length} unknown</Badge> : null}
            {report.concatenated.length ? <Badge tone="warn">Split concatenated words</Badge> : null}
          </div>
          <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {report.words.map((w) => (
              <li
                key={`${w.index}-${w.word}`}
                className={cn(
                  "flex items-baseline gap-2 rounded-md bg-surface-2 px-2 py-1.5 font-mono text-xs ring-1",
                  w.status === "ok" ? "ring-border" : "ring-danger/40 text-danger",
                )}
              >
                <span className="text-subtle tabular-nums">{w.index}</span>
                <span>{w.word || "—"}</span>
              </li>
            ))}
          </ol>
          {report.concatenated.map((c) => (
            <p key={c.blob} className="text-xs text-muted">
              “{c.blob}” → {c.parts.join(" + ")}
            </p>
          ))}
          <ul className="grid gap-1.5 text-sm text-pretty text-muted">
            {report.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted text-pretty">
          This tool can split words, number a 12-word list, detect accidental joins such as satcheloutskirts, check the English BIP-39 list, and verify the checksum. It will not guess missing words.
        </p>
      )}
    </div>
  );
}
