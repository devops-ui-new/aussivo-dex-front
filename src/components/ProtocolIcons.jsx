/**
 * ProtocolIcons — compact, brand-evoking marks for the DeFi protocols the Aussivo vaults
 * route capital to (as defined in each vault's `strategies`). These are simplified,
 * recognizable glyphs in each protocol's brand colors (for integration display), not exact
 * trademarked artwork. Resolve an icon from a strategy's `protocol` or `name`.
 */

/* ── Individual marks (rounded-square app-icon style, 24×24 viewBox) ── */

export function AaveIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs><linearGradient id="pi-aave" x1="0" y1="0" x2="24" y2="24"><stop stopColor="#B6509E" /><stop offset="1" stopColor="#2EBAC6" /></linearGradient></defs>
      <rect width="24" height="24" rx="6" fill="url(#pi-aave)" />
      <path d="M6.5 17v-5.2a5.5 5.5 0 0 1 11 0V17l-1.83-1.2L14 17l-1.9-1.2L10.2 17 8.3 15.8 6.5 17Z" fill="#fff" />
      <circle cx="10" cy="11" r="1" fill="#B6509E" /><circle cx="14" cy="11" r="1" fill="#2EBAC6" />
    </svg>
  );
}

export function CompoundIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#070A0E" />
      <path d="M12 4.5a7.5 7.5 0 1 0 7.5 7.5" stroke="#00D395" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M12 8a4 4 0 1 0 4 4" stroke="#00D395" strokeOpacity=".55" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function VenusIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs><linearGradient id="pi-venus" x1="0" y1="0" x2="24" y2="24"><stop stopColor="#F5C542" /><stop offset="1" stopColor="#42D6C0" /></linearGradient></defs>
      <rect width="24" height="24" rx="6" fill="url(#pi-venus)" />
      <path d="M7 7.5 12 16l5-8.5" stroke="#0b1020" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CurveIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#0a0f1e" />
      <path d="M17 7.5A6.5 6.5 0 0 0 7 12.7" stroke="#ff2d55" strokeWidth="2" strokeLinecap="round" />
      <path d="M17.5 11A6.5 6.5 0 0 0 8 15.8" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 14.5A6.5 6.5 0 0 0 9.5 18.5" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function BinanceIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#181A20" />
      <g fill="#F3BA2F">
        <rect x="10.6" y="5.4" width="3.7" height="3.7" rx="1" transform="rotate(45 12.45 7.25)" />
        <rect x="10.6" y="14.9" width="3.7" height="3.7" rx="1" transform="rotate(45 12.45 16.75)" />
        <rect x="5.8" y="10.15" width="3.7" height="3.7" rx="1" transform="rotate(45 7.65 12)" />
        <rect x="15.4" y="10.15" width="3.7" height="3.7" rx="1" transform="rotate(45 17.25 12)" />
        <rect x="10.9" y="10.4" width="3.2" height="3.2" rx="1" transform="rotate(45 12.5 12)" />
      </g>
    </svg>
  );
}

export function ConvexIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs><linearGradient id="pi-cvx" x1="0" y1="0" x2="24" y2="24"><stop stopColor="#3A6DF0" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs>
      <rect width="24" height="24" rx="6" fill="url(#pi-cvx)" />
      <path d="M15.5 8.2A5 5 0 1 0 16 15" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

export function MorphoIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#0f1530" />
      <path d="M6 17V9l3 3 3-4 3 4 3-3v8" stroke="#4c8dff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function UniswapIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#FF007A" />
      <path d="M9 16c-2.5-1-3-4-1.5-6C9 8 11 8.5 12 10c-1-3 1-5 3.5-4.5C13 6 14.5 8 15.5 9.5 17 11.7 16 15 13 16.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function ReserveIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#0e241b" />
      <path d="M12 5l5 2v4c0 3.2-2.1 5.4-5 6.5-2.9-1.1-5-3.3-5-6.5V7l5-2Z" fill="none" stroke="#00e676" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9.5 12l1.8 1.8L15 10.5" stroke="#00e676" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DefiIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#0b1a12" />
      <path d="M12 5l6 3.5v7L12 19l-6-3.5v-7L12 5Z" fill="none" stroke="#00e676" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.2" fill="#00e676" />
    </svg>
  );
}

/* ── Registry + resolver ── */

const REG = {
  aave: { label: "Aave", Icon: AaveIcon },
  compound: { label: "Compound", Icon: CompoundIcon },
  venus: { label: "Venus", Icon: VenusIcon },
  curve: { label: "Curve", Icon: CurveIcon },
  binance: { label: "Binance", Icon: BinanceIcon },
  convex: { label: "Convex", Icon: ConvexIcon },
  morpho: { label: "Morpho", Icon: MorphoIcon },
  uniswap: { label: "Uniswap", Icon: UniswapIcon },
  reserve: { label: "Reserve", Icon: ReserveIcon },
  defi: { label: "DeFi", Icon: DefiIcon },
};

export function resolveProtocolKey(s = "") {
  const t = String(s).toLowerCase();
  if (t.includes("aave")) return "aave";
  if (t.includes("compound")) return "compound";
  if (t.includes("venus")) return "venus";
  if (t.includes("curve")) return "curve";
  if (t.includes("convex")) return "convex";
  if (t.includes("morpho")) return "morpho";
  if (t.includes("uniswap") || t.includes("uni v3")) return "uniswap";
  if (t.includes("binance") || t.includes("funding") || t.includes("arb") || t.includes("perp") || t.includes("basis")) return "binance";
  if (t.includes("reserve") || t.includes("insurance") || t.includes("internal") || t.includes("buffer")) return "reserve";
  return "defi";
}

export function protocolMeta(strategy) {
  const src = typeof strategy === "string" ? strategy : (strategy?.protocol || strategy?.name || "");
  const key = resolveProtocolKey(src);
  return { key, ...REG[key] };
}

/* ── Composed display helpers ── */

/** A single protocol icon (optionally with label), resolved from a strategy/name/protocol. */
export function ProtocolChip({ strategy, size = 22, showLabel = false, className = "" }) {
  const { label, Icon } = protocolMeta(strategy);
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={label}>
      <Icon size={size} />
      {showLabel && <span className="text-xs font-medium">{label}</span>}
    </span>
  );
}

/** A de-duplicated row of protocol icons for a list of strategies. */
export function ProtocolRow({ strategies = [], size = 22, showLabels = false, max, className = "" }) {
  const seen = new Set();
  const items = [];
  for (const s of strategies) {
    const { key, label, Icon } = protocolMeta(s);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ key, label, Icon });
  }
  const shown = max ? items.slice(0, max) : items;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {shown.map(({ key, label, Icon }) => (
        <span key={key} className="inline-flex items-center gap-1.5" title={label}>
          <Icon size={size} />
          {showLabels && <span className="text-xs font-medium text-slate-300">{label}</span>}
        </span>
      ))}
      {max && items.length > max && <span className="text-xs text-slate-500">+{items.length - max}</span>}
    </div>
  );
}

/** "Powered by" strip — a labeled row of protocol icons. */
export function PoweredBy({ strategies = [], size = 22, showLabels = true, className = "" }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Powered by</span>
      <ProtocolRow strategies={strategies} size={size} showLabels={showLabels} />
    </div>
  );
}