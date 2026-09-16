export interface LogoProps {
  size?: number;
  withText?: boolean;
}

/** Crypto Arena mark: a shield (the arena) with a rising price line. */
export function Logo({ size = 32, withText = true }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="ca-logo" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="#0b0f1a" />
        <path d="M32 10 L52 20 V34 C52 45 43 52 32 56 C21 52 12 45 12 34 V20 Z" fill="url(#ca-logo)" />
        <path d="M24 40 L30 30 L35 36 L42 24" stroke="#0b0f1a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="42" cy="24" r="3" fill="#34d399" />
      </svg>
      {withText && (
        <span className="text-lg font-bold tracking-tight">
          Crypto<span className="text-accent-300">Arena</span>
        </span>
      )}
    </span>
  );
}
