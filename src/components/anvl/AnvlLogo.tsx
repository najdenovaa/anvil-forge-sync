/**
 * Anvl — inline SVG wordmark logo.
 * Pure transparent (no background), scales crisply at any size.
 */
export function AnvlLogo({ className, title = "ANVL" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 220 80"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
    >
      <title>{title}</title>
      {/* Mark: stylised "A" / chevron */}
      <g transform="translate(8 6)">
        <path
          d="M28 0 L56 56 L42 56 L36 44 L20 44 L14 56 L0 56 Z M24 32 L32 32 L28 22 Z"
          fill="currentColor"
        />
      </g>
      {/* Wordmark: ANVL */}
      <g
        transform="translate(78 56)"
        fill="currentColor"
        style={{
          font: "700 40px/1 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Inter, sans-serif",
          letterSpacing: "0.04em",
        }}
      >
        <text>ANVL</text>
      </g>
    </svg>
  );
}
