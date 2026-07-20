import { API } from "../config/api";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatsBar from "../components/StatsBar";
import PoolCard from "../components/PoolCard";
import SecurityInfra from "../components/SecurityInfra";
import heroPlatformVideo from "../assets/home/airdrops_v4.mp4";
import referralIllustration from "../assets/home/referral-illustration.png";

/**
 * DESIGN NOTES
 *
 * The page read as patchy for three concrete reasons, all fixed here:
 *
 * 1. FOUR TYPEFACES, TWO BY ACCIDENT. Section headings hard-coded `Poppins` and `Inter`
 *    inline, but index.html only loads Outfit + DM Sans — so those headings silently fell
 *    back to system Helvetica while the hero rendered in Outfit. Everything now uses the
 *    two loaded faces. No inline font overrides anywhere.
 *
 * 2. NO TYPE SCALE. Headings were pinned at 56px/63px: overflowing on mobile, undersized
 *    on a large display. Display sizes are fluid via clamp().
 *
 * 3. NO VERTICAL RHYTHM. Sections used six different spacing values. One `Section`
 *    wrapper owns spacing so the page has a consistent beat.
 *
 * Palette is deliberately unchanged — near-black + #00e676 is the established brand.
 * Section order ends on Referrals so the page closes on an action.
 */

/* Shared vertical rhythm. One place to tune the page's pacing. */
function Section({ id, children, className = "", tight = false }) {
  return (
    <section
      id={id}
      className={`mx-auto w-full max-w-7xl px-6 ${tight ? "py-14" : "py-20 md:py-28"} ${className}`}
    >
      {children}
    </section>
  );
}

/** One centred heading treatment for every section. */
function SectionHeading({ eyebrow, title, accent, sub, action }) {
  return (
    <div className="mb-12 text-center md:mb-14">
      {eyebrow && (
        <div className="mb-4 flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-brand/40" aria-hidden />
          <span className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-brand/90">
            {eyebrow}
          </span>
          <span className="h-px w-8 bg-brand/40" aria-hidden />
        </div>
      )}
      <h2
        className="font-display font-semibold tracking-[-0.02em] text-slate-50"
        style={{ fontSize: "clamp(2rem, 4vw, 3.1rem)", lineHeight: 1.1 }}
      >
        {title} {accent && <span className="text-gradient">{accent}</span>}
      </h2>
      {sub && <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-relaxed text-slate-400">{sub}</p>}
      {action && <div className="mt-7 flex justify-center">{action}</div>}
    </div>
  );
}

export default function Home() {
  const [pools, setPools] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/pools`).then((r) => r.json()).then(setPools).catch(() => {});
  }, []);

  const topPools = pools.filter((p) => p.active).slice(0, 3);

  // Numbering is used here because this genuinely is a sequence — the reader needs the
  // order. It is not applied to sections where order carries no meaning.
  const steps = [
    { n: "01", title: "Connect your wallet", body: "MetaMask, Trust, or any browser wallet. Nothing is signed away." },
    { n: "02", title: "Choose a vault", body: "Compare APY, lock period and strategy before you commit." },
    { n: "03", title: "Earn yield", body: "Yield accrues every cycle. Withdraw principal whenever you like." },
  ];

  return (
    <div className="bg-[#010101]">
      {/* ───────────────────────── HERO ─────────────────────────
          Product visual is full-bleed, running past the right edge, so it reads as
          atmosphere rather than a boxed illustration. Percentage offsets replace the old
          fixed pixel values, so it holds at any width. */}
      <section className="relative -mt-[82px] overflow-hidden pt-[82px]">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute right-[-6%] top-0 hidden h-full w-[78%] lg:block">
            <video
              src={heroPlatformVideo}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover object-center"
            />
          </div>

          {/* Fade the video into the background from the left so the headline stays
              legible. Two stops rather than the previous five overlapping layers. */}
          <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,#010101_0%,#010101_34%,rgba(1,1,1,0.82)_48%,rgba(1,1,1,0.35)_62%,transparent_78%)] lg:block" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent,#010101)]" />
          <div
            className="absolute inset-x-0 -top-24 h-[420px] opacity-70"
            style={{ background: "radial-gradient(50% 100% at 30% 0%, rgba(0,230,118,0.12) 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-16 pt-10 lg:pb-24 lg:pt-14">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-brand/25 bg-brand/[0.06] py-1.5 pl-2.5 pr-4">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
              <span className="font-display text-[11px] font-medium tracking-[0.14em] text-brand/90">
                LIVE ON BNB CHAIN
              </span>
            </div>

            <h1
              className="font-display font-semibold tracking-[-0.025em]"
              style={{ fontSize: "clamp(2.15rem, 3.9vw, 3.4rem)", lineHeight: 1.08 }}
            >
              <span className="block text-slate-50">Earn yield on</span>
              <span className="block text-gradient">stablecoins</span>
              <span className="block text-slate-50">without the complexity</span>
            </h1>

            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-slate-400 md:text-base">
              Deposit USDT or USDC into audited vaults and earn up to 18% APY from
              institutional-grade strategies. On-chain, non-custodial, withdraw anytime.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/pools" className="btn-primary px-7 py-3 text-[15px]">Start earning</Link>
              <a href="#how-it-works" className="btn-secondary px-7 py-3 text-[15px]">How it works</a>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-white/[0.07] pt-5">
              {["Audited contracts", "Non-custodial", "Real-time rewards"].map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="3" aria-hidden>
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[13px] text-slate-400">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats sit flush against the hero as a ledger strip. */}
      <div className="border-y border-white/[0.06]">
        <StatsBar />
      </div>

      {/* ───────────────────────── VAULTS ───────────────────────── */}
      <Section>
        <SectionHeading
          eyebrow="Vaults"
          title="Where your"
          accent="capital works"
          sub="Curated yield strategies, each one on-chain and verifiable. Compare before you commit."
          action={<Link to="/pools" className="btn-secondary px-6 py-2.5 text-sm">View all vaults →</Link>}
        />
        {/* Column count follows the number of vaults, capped and centred below three —
            otherwise two cards sit hard left against an empty third slot. */}
        <div
          className={`grid gap-5 ${
            topPools.length === 1
              ? "mx-auto max-w-md"
              : topPools.length === 2
              ? "mx-auto max-w-4xl md:grid-cols-2"
              : "md:grid-cols-3"
          }`}
        >
          {topPools.map((pool) => <PoolCard key={pool.id} pool={pool} variant="home-dark" />)}
          {topPools.length === 0 &&
            [0, 1, 2].map((i) => <div key={i} className="glass h-[320px] shimmer rounded-2xl" />)}
        </div>
      </Section>

      {/* ───────────────────────── HOW IT WORKS ─────────────────────────
          The old version used 190px circles joined by connectors positioned at
          calc(16.666% + 95px), which drifted apart at most widths. A plain grid with one
          rule behind it cannot break. */}
      <Section id="how-it-works">
        <SectionHeading
          eyebrow="Getting started"
          title="Three steps to"
          accent="your first yield"
          sub="No bridging, no LP tokens, no gas games. Deposit a stablecoin and you're done."
        />
        <div className="relative mx-auto max-w-5xl">
          <div
            className="pointer-events-none absolute left-0 right-0 top-[26px] hidden h-px md:block"
            style={{ background: "linear-gradient(90deg, transparent, rgba(0,230,118,0.28) 18%, rgba(0,230,118,0.28) 82%, transparent)" }}
            aria-hidden
          />
          <div className="grid gap-10 text-center md:grid-cols-3 md:gap-8">
            {steps.map((s) => (
              <div key={s.n} className="relative flex flex-col items-center">
                <div className="mb-6 flex h-[52px] w-[52px] items-center justify-center rounded-full border border-brand/30 bg-[#020707] font-display text-sm font-semibold text-brand shadow-[0_0_24px_rgba(0,230,118,0.10)]">
                  {s.n}
                </div>
                <h3 className="font-display text-xl font-semibold text-slate-50">{s.title}</h3>
                <p className="mt-2.5 max-w-xs text-[15px] leading-relaxed text-slate-400">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ───────────────────────── SECURITY ───────────────────────── */}
      <Section tight>
        <SecurityInfra />
      </Section>

      {/* ───────────────────────── REFERRALS ─────────────────────────
          Last, so the page closes on an action rather than being interrupted by one.
          Larger than before so it reads as a section in its own right. */}
      <Section className="pb-28">
        <div className="relative overflow-hidden rounded-[28px] border border-brand/25 bg-[#020806]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(70% 130% at 15% 50%, rgba(0,230,118,0.16) 0%, transparent 60%)" }}
            aria-hidden
          />
          <div className="relative z-10 grid items-center gap-10 p-10 md:grid-cols-[1fr_300px] md:p-16 lg:p-20">
            <div>
              <div className="mb-5 flex items-center gap-3">
                <span className="h-px w-8 bg-brand/50" aria-hidden />
                <span className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-brand/90">
                  Referrals
                </span>
              </div>
              <h2
                className="font-display font-semibold tracking-[-0.02em] text-slate-50"
                style={{ fontSize: "clamp(2.1rem, 4vw, 3.25rem)", lineHeight: 1.08 }}
              >
                Earn more by <span className="text-gradient">bringing others</span>
              </h2>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-400">
                Share your link and earn commission from protocol fees on two levels —
                paid on the yield your referrals generate, for as long as they stay.
              </p>
              <Link to="/referral" className="btn-primary mt-9 inline-block px-8 py-3.5 text-base">
                Get your link
              </Link>
            </div>
            <div className="justify-self-center md:justify-self-end">
              <img src={referralIllustration} alt="" aria-hidden className="w-full max-w-[300px]" />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}