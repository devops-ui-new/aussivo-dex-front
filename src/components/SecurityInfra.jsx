import toast from "react-hot-toast";

/**
 * SecurityInfra — trust section stating that Aussivo's smart contracts are powered by the
 * audited Krystal Vault framework and independently audited by Verichains, with the full
 * Krystal Vault contract set (names + on-chain addresses) and links to source + audit report.
 */

export const KRYSTAL_REPO = "https://github.com/KrystalDeFi/krystal-vault-contracts-v2";
export const VERICHAINS_REPO = "https://github.com/verichains/public-audit-reports";
export const VERICHAINS_REPORT =
  "https://github.com/verichains/public-audit-reports/blob/main/Verichains%20Public%20Audit%20Report%20-%20Krystal%20-%20v1.1.pdf";

// Canonical Krystal Vault v2 contracts (deterministic addresses, deployed across Base / Arbitrum).
export const KRYSTAL_CONTRACTS = [
  { name: "Vault", address: "0x964b88db9c467c34e8d5d2b1b833e8e6ae46198a", desc: "Core tokenized vault" },
  { name: "Vault Factory", address: "0xff630c5d2fb9920c29c264b85e968d435f07e293", desc: "Deploys new vaults" },
  { name: "Vault Automator", address: "0xc0475a35e3498cefd923a6620f369628a5b65f31", desc: "Automated rebalancing" },
  { name: "Config Manager", address: "0x46ba78754baae4219071a250f43d38e27a91338a", desc: "Configuration & policy" },
  { name: "Pool Optimal Swapper", address: "0x6d993f3035a343bf10109c61266c5fc4d37a714d", desc: "Optimal-route swaps" },
  { name: "LP Strategy", address: "0x851ee187bc85152708d38a421d48733f1490a8e3", desc: "Liquidity strategy logic" },
  { name: "LP Validator", address: "0xc06be42e0a4eb1010ae41eef27a5ce2207023cd8", desc: "Position validation" },
  { name: "LP Fee Taker", address: "0xc1ec78f70680342930f52707d1f653d492bcd603", desc: "Fee collection" },
  { name: "Merkl Automator", address: "0x774c949b244a69142aee0a67ad46c9a79b6aaa5a", desc: "Merkl rewards automation" },
  { name: "Merkl Strategy", address: "0x34c197554d32b59d9a3d1a358fc9a86e69d4cec0", desc: "Merkl rewards strategy" },
];

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const explorer = (a) => `https://basescan.org/address/${a}`;

/* ── Brand icons ── */
export function KrystalIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs><linearGradient id="krys-g" x1="0" y1="0" x2="24" y2="24"><stop stopColor="#2DE2B6" /><stop offset="1" stopColor="#2AA9E0" /></linearGradient></defs>
      <path d="M7 3h10l4 6-9 12L3 9l4-6Z" fill="url(#krys-g)" />
      <path d="M7 3 12 9l5-6M3 9h18M12 9v12" stroke="#06251f" strokeOpacity=".55" strokeWidth="1" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function VerichainsIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs><linearGradient id="veri-g" x1="0" y1="0" x2="24" y2="24"><stop stopColor="#3B82F6" /><stop offset="1" stopColor="#22D3EE" /></linearGradient></defs>
      <path d="M12 2.5 20 6v5.5c0 4.6-3.2 7.9-8 9.5-4.8-1.6-8-4.9-8-9.5V6l8-3.5Z" fill="url(#veri-g)" />
      <path d="M8.5 12.2 11 14.7l4.8-5" stroke="#04121f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Compact one-line trust strip for footers / hero areas. */
export function KrystalVerichainsStrip({ className = "" }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
      <a href={KRYSTAL_REPO} target="_blank" rel="noopener noreferrer"
        className="group inline-flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 transition-colors hover:border-brand/30">
        <KrystalIcon size={18} />
        <span className="text-xs font-semibold text-slate-200">Powered by <span className="text-brand">Krystal Vaults</span></span>
      </a>
      <a href={VERICHAINS_REPORT} target="_blank" rel="noopener noreferrer"
        className="group inline-flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 transition-colors hover:border-blue-400/30">
        <VerichainsIcon size={18} />
        <span className="text-xs font-semibold text-slate-200">Audited by <span className="text-blue-300">Verichains</span></span>
      </a>
    </div>
  );
}

/** Full "Smart-contract security" section. */
export default function SecurityInfra({ className = "" }) {
  const copy = (a) => { navigator.clipboard?.writeText(a); toast.success("Address copied"); };

  return (
    <section className={`rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#0c1120] to-[#0a0f1e] p-6 sm:p-8 ${className}`}>
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand">Smart-contract security</div>
      <h2 className="mt-2 max-w-3xl font-display text-2xl sm:text-3xl font-bold text-white">
        All Aussivo smart contracts are powered by <span className="text-brand">Krystal Vaults</span> and independently <span className="text-blue-300">audited by Verichains</span>.
      </h2>
      <p className="mt-3 max-w-3xl text-sm text-slate-400">
        Aussivo builds on the battle-tested, open-source Krystal Vault framework — a modular vault
        architecture with automated rebalancing and on-chain policy enforcement — reviewed in an
        independent security audit by Verichains.
      </p>

      {/* Two badges */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <a href={KRYSTAL_REPO} target="_blank" rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition-all hover:border-brand/40 hover:bg-white/[0.035]">
          <div className="shrink-0"><KrystalIcon size={38} /></div>
          <div className="min-w-0">
            <div className="font-display text-base font-bold text-white">Powered by Krystal Vaults</div>
            <div className="text-xs text-slate-400">Audited vault framework · open-source contracts</div>
            <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand">View contracts on GitHub
              <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
        </a>
        <a href={VERICHAINS_REPORT} target="_blank" rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition-all hover:border-blue-400/40 hover:bg-white/[0.035]">
          <div className="shrink-0"><VerichainsIcon size={38} /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-bold text-white">Audited by Verichains</span>
              <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300">v1.1</span>
            </div>
            <div className="text-xs text-slate-400">Independent smart-contract security audit</div>
            <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-300">Read the audit report
              <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
        </a>
      </div>

      {/* Contracts */}
      <div className="mt-7 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-slate-200">Krystal Vault contracts</h3>
        <a href={KRYSTAL_REPO} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand hover:underline">All contracts ↗</a>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {KRYSTAL_CONTRACTS.map((c) => (
          <div key={c.name} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3.5 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                <svg className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {c.name}
              </div>
              <div className="text-[11px] text-slate-500">{c.desc}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a href={explorer(c.address)} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-slate-400 hover:text-brand" title={c.address}>{short(c.address)}</a>
              <button onClick={() => copy(c.address)} className="text-slate-500 hover:text-brand" aria-label={`Copy ${c.name} address`}>
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-slate-500">
        Addresses shown are the canonical Krystal Vault v2 deployments (deterministic across supported EVM networks). Source: <a href={KRYSTAL_REPO} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-brand">krystal-vault-contracts-v2</a>.
      </p>
    </section>
  );
}