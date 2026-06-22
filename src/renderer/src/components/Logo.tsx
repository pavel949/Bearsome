interface Props {
  size?: number
}

/**
 * The Bearsome mark: a friendly bear face built into a rounded "block",
 * nodding to both gaming (the block) and the brand (the bear). Pure inline SVG
 * so it needs no asset pipeline or CSP allowance.
 */
export function Logo({ size = 28 }: Props): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="16" fill="#171a23" stroke="#2a3040" strokeWidth="2" />
      {/* ears */}
      <circle cx="22" cy="22" r="7" fill="#4ade80" />
      <circle cx="42" cy="22" r="7" fill="#4ade80" />
      {/* head */}
      <circle cx="32" cy="36" r="16" fill="#4ade80" />
      {/* snout */}
      <ellipse cx="32" cy="42" rx="8" ry="6" fill="#0f1117" />
      {/* eyes */}
      <circle cx="26" cy="33" r="2.4" fill="#0f1117" />
      <circle cx="38" cy="33" r="2.4" fill="#0f1117" />
      {/* nose */}
      <circle cx="32" cy="39" r="2.4" fill="#4ade80" />
    </svg>
  )
}
