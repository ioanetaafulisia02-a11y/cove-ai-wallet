export function CoveMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 9.5h6.2c4 0 6.6 2.4 6.6 6.5s-2.6 6.5-6.6 6.5H10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
