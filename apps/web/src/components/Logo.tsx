/** The mark: a tombstone with a sprout growing from its top. Colors come from CSS classes. */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg className={`mark${className ? ` ${className}` : ''}`} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path className="mark-stone" d="M18 54 V32 a14 14 0 0 1 28 0 V54 Z" />
      <path className="mark-engraving" d="M25 36 H39 M25 43 H35" />
      <path className="mark-ground" d="M10 56 H54" />
      <path className="mark-stem" d="M32 18 V9" />
      <path className="mark-leaf" d="M32 12 C 32 7, 36 5, 41 5 C 41 10, 37 12, 32 12 Z" />
      <path className="mark-leaf" d="M32 14 C 32 9, 28 7, 23 7 C 23 12, 27 14, 32 14 Z" />
    </svg>
  );
}
