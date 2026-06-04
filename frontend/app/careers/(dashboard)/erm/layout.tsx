import type { ReactNode } from 'react';

/**
 * ERM section layout. Phase 0 is a pass-through; ERM Phase 1 will host
 * the right-side panel (exceptions / queue counts) here so it persists
 * across all 14 ERM pages without re-render.
 */
export default function ErmLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
