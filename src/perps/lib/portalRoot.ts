import { createContext, useContext } from 'react';

/**
 * The element portalled overlays must mount into.
 *
 * All terminal CSS is scoped under `.perp-terminal`, so anything portalled to
 * `document.body` lands outside that subtree and renders completely unstyled.
 * Overlays mount here instead — the terminal root itself, which is inside the
 * scope. It carries no transform/filter, so `position: fixed` children still
 * position against the viewport as intended.
 */
export const PortalRootContext = createContext<HTMLElement | null>(null);

export function usePortalRoot(): HTMLElement | null {
  const el = useContext(PortalRootContext);
  // Before the root ref resolves (first render) there is nothing to portal into;
  // callers skip rendering rather than fall back to an unstyled document.body.
  return el ?? (typeof document === 'undefined' ? null : document.body);
}
