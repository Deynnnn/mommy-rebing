"use client";

/**
 * Custom checkbox: a real (visually hidden) input for keyboard and screen readers, drawn as a
 * rounded box that fills gold with a white tick when checked, or a dash when partly checked.
 */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  variant = "light",
  className = "",
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  /** "overlay" for use on top of photos */
  variant?: "light" | "overlay";
  className?: string;
}) {
  const on = checked || indeterminate;
  const off =
    variant === "overlay"
      ? "border-white/90 bg-black/30 backdrop-blur-sm group-hover:bg-black/45"
      : "border-ink/30 bg-paper group-hover:border-gold";
  return (
    <span className={`group relative inline-flex shrink-0 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={onChange}
        aria-label={label}
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden
        className={`flex h-6 w-6 items-center justify-center rounded-md border-2 shadow-sm transition-all duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-focus-visible:ring-offset-2 peer-active:scale-90 ${
          on ? "border-gold bg-gold text-white" : off
        }`}
      >
        {checked ? (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        ) : indeterminate ? (
          <span className="h-0.5 w-2.5 rounded bg-white" />
        ) : null}
      </span>
    </span>
  );
}
