import { NETWORK_LIST, type NetworkKey } from "@/lib/wallet/networks";
import { cn } from "@/lib/utils";

export function NetworkSelect({
  value,
  onChange,
}: {
  value: NetworkKey;
  onChange: (key: NetworkKey) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">Network</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as NetworkKey)}
        className={cn(
          "h-11 w-full rounded-lg bg-surface-2 px-3 text-sm text-fg ring-1 ring-border",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {NETWORK_LIST.map((n) => (
          <option key={n.key} value={n.key}>
            {n.name}
          </option>
        ))}
      </select>
    </label>
  );
}
