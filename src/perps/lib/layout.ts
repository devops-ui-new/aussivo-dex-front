/** Terminal layout: which panel sits in which slot, and the resizable track sizes. */

export type PanelId = 'chart' | 'book' | 'trade' | 'tables';
export type SlotId = 'main' | 'side' | 'rail' | 'bottom';

export interface Layout {
  /** slot -> panel currently rendered there. */
  slots: Record<SlotId, PanelId>;
  /** Widths/heights of the resizable tracks, in px. */
  sideW: number;
  railW: number;
  bottomH: number;
}

export const DEFAULT_LAYOUT: Layout = {
  slots: { main: 'chart', side: 'book', rail: 'trade', bottom: 'tables' },
  sideW: 340,
  railW: 340,
  bottomH: 300,
};

export const LIMITS = {
  sideW: [240, 620],
  railW: [280, 560],
  bottomH: [140, 640],
} as const;

export function clamp(v: number, [lo, hi]: readonly [number, number]): number {
  return Math.min(hi, Math.max(lo, v));
}

const KEY = 'builderfi.layout.v1';

export function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<Layout>;
    const slots = { ...DEFAULT_LAYOUT.slots, ...(parsed.slots ?? {}) };
    // A corrupt/partial map would blank a panel — only accept a full permutation.
    const values = Object.values(slots);
    const complete = new Set(values).size === 4 && values.length === 4;
    return {
      slots: complete ? slots : DEFAULT_LAYOUT.slots,
      sideW: clamp(parsed.sideW ?? DEFAULT_LAYOUT.sideW, LIMITS.sideW),
      railW: clamp(parsed.railW ?? DEFAULT_LAYOUT.railW, LIMITS.railW),
      bottomH: clamp(parsed.bottomH ?? DEFAULT_LAYOUT.bottomH, LIMITS.bottomH),
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(l: Layout): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    // storage unavailable — layout just won't persist
  }
}

/** Swap the slots occupied by two panels. */
export function swapPanels(slots: Record<SlotId, PanelId>, a: PanelId, b: PanelId) {
  const entries = Object.entries(slots) as [SlotId, PanelId][];
  const slotA = entries.find(([, p]) => p === a)?.[0];
  const slotB = entries.find(([, p]) => p === b)?.[0];
  if (!slotA || !slotB) return slots;
  return { ...slots, [slotA]: b, [slotB]: a };
}
