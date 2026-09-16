import type { ProfilerOnRenderCallback } from 'react';

/**
 * Dev-only React Profiler callback: logs the render cost of a subtree in the console.
 * Used to *measure before optimising* (e.g. CryptoTable: ~50 rows x sparkline). Compare the
 * "update" durations while typing in the search box with and without memo/useMemo.
 */
export const logRenderProfile: ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration) => {
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test') return;
  console.debug(
    `[Profiler] ${id} ${phase}: ${actualDuration.toFixed(1)} ms (sans memo ≈ ${baseDuration.toFixed(1)} ms)`,
  );
};
