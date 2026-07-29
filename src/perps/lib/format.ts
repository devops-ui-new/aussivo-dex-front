// Hyperliquid perp prices carry at most 5 significant figures and at most
// (6 - szDecimals) decimal places. Sizes use szDecimals decimals.

export function pxDecimals(szDecimals: number, px: number): number {
  const maxDp = Math.max(0, 6 - szDecimals);
  if (px <= 0) return Math.min(maxDp, 4);
  // 5 significant figures: 63339 → 0dp, 74.844 → 3dp, 0.053923 → 6dp.
  const exp = Math.floor(Math.log10(px));
  return Math.min(maxDp, Math.max(0, 4 - exp));
}

export function formatPx(px: number, szDecimals: number): string {
  return px.toLocaleString('en-US', {
    minimumFractionDigits: pxDecimals(szDecimals, px),
    maximumFractionDigits: pxDecimals(szDecimals, px),
  });
}

export function formatSz(sz: number, szDecimals: number): string {
  return sz.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: szDecimals,
  });
}

export function formatUsd(v: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact) {
    return `$${v.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}`;
  }
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPct(v: number, dp = 2): string {
  const s = (v * 100).toFixed(dp);
  return `${v > 0 ? '+' : ''}${s}%`;
}

export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatClock(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} (UTC)`;
}
