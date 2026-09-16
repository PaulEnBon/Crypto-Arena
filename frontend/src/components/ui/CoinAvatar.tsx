import { useState } from 'react';

export interface CoinAvatarProps {
  src: string | null | undefined;
  symbol: string;
  size?: number;
  className?: string;
}

/** Coin logo with a deterministic initials fallback when the image is missing or fails to load. */
export function CoinAvatar({ src, symbol, size = 32, className = '' }: CoinAvatarProps) {
  const [failed, setFailed] = useState(false);
  const dimension = { width: size, height: size };

  if (!src || failed) {
    return (
      <span
        style={dimension}
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-arena-600 text-[10px] font-bold text-ink-200 ${className}`}
        aria-hidden="true"
      >
        {symbol.slice(0, 3).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      style={dimension}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full bg-arena-700 ${className}`}
    />
  );
}
