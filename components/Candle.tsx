export function Candle({ className = "h-10 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 40" className={className} aria-hidden="true">
      <g className="flame">
        <path d="M12 2c3 4 4 6.5 4 9a4 4 0 0 1-8 0c0-2.5 1-5 4-9z" fill="#e8b65a" />
        <path d="M12 6c1.6 2.4 2 3.8 2 5.2a2 2 0 0 1-4 0c0-1.4.4-2.8 2-5.2z" fill="#fff3d1" />
      </g>
      <rect x="8" y="16" width="8" height="22" rx="1.5" fill="#f3ead9" stroke="#d9c9a8" />
    </svg>
  );
}
