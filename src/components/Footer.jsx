import brandLogo from "../assets/branding/logo-aussivo.png";
import toast from "react-hot-toast";
import OnChainTicker from "./OnChainTicker";
import { Link } from "react-router-dom";
import { KrystalVerichainsStrip } from "./SecurityInfra";
import { CONTRACTS, explorerAddress, shortAddr } from "../config/chain";
import {
  IconDiscord,
  IconInstagram,
  IconLinkedIn,
  IconTelegram,
  IconX,
  IconYouTube,
} from "./SocialIcons";

const SOCIAL_LINKS = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/aussivo/?viewAsMember=true",
    Icon: IconLinkedIn,
  },
  { label: "X", href: "https://x.com/aussivo", Icon: IconX },
  { label: "Telegram", href: "https://t.me/aussivo", Icon: IconTelegram },
  { label: "YouTube", href: "https://www.youtube.com/@Aussivo", Icon: IconYouTube },
  { label: "Instagram", href: "https://www.instagram.com/aussivo_official/", Icon: IconInstagram },
  { label: "Discord", href: "https://discord.com/invite/MF53Ww9s6g", Icon: IconDiscord },
];

/** Pixel sizes via inline styles + SVG width/height — survives stale `vite preview` / CSS purging. */
const SOCIAL_BTN_PX = 24;
const SOCIAL_ICON_PX = 12;

const socialBtnClass =
  "inline-flex shrink-0 items-center justify-center rounded border border-slate-500/60 bg-[#0f172a] text-slate-100 transition-colors hover:border-[#00e676] hover:bg-[#1e293b] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-[#00e676]";

function SocialLinksRow({ className = "" }) {
  return (
    <div
      className={`flex w-full max-w-full flex-wrap items-center justify-center gap-1.5 ${className}`}
      role="navigation"
      aria-label="Social media links"
    >
      {SOCIAL_LINKS.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={socialBtnClass}
          style={{
            width: SOCIAL_BTN_PX,
            height: SOCIAL_BTN_PX,
            minWidth: SOCIAL_BTN_PX,
            minHeight: SOCIAL_BTN_PX,
            boxSizing: "border-box",
          }}
        >
          <Icon size={SOCIAL_ICON_PX} />
        </a>
      ))}
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="relative z-50 mt-20 border-t border-slate-600/40 bg-[#060b18] isolate">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid min-w-0 gap-10 border-b border-slate-600/30 pb-10 lg:grid-cols-[1.3fr_0.8fr_0.8fr_1fr_1.9fr]">
          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <img src={brandLogo} alt="Aussivo.DEX" className="h-8 w-auto" />
            </div>
            <p className="text-xs text-muted">Empowering Your Decentralized Future</p>
          </div>

          <div className="relative z-20 min-w-0">
            <div className="mb-4 text-[1.35rem] font-semibold">Quick Links</div>
            <div className="flex flex-col items-start space-y-2.5 text-sm text-slate-300">
              {/* In-app routes — react-router Link so navigation stays client-side. */}
              {[
                { to: "/", label: "Home" },
                { to: "/pools", label: "Vaults" },
                { to: "/swap", label: "Swap" },
                { to: "/portfolio", label: "Portfolio" },
                { to: "/referral", label: "Referral" },
              ].map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="relative z-30 inline-block cursor-pointer underline-offset-2 transition-colors hover:text-slate-100 hover:underline"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="relative z-20 min-w-0">
            <div className="mb-4 text-[1.35rem] font-semibold">Company</div>
            <div className="flex flex-col items-start space-y-2.5 text-sm text-slate-300">
              {/* Marketing site — external, so plain anchors with noopener. */}
              {[
                { href: "https://aussivo.com/about-us", label: "About Us" },
                { href: "https://aussivo.com/blog", label: "Blogs" },
                { href: "https://aussivo.com/contact-us", label: "Contact Us" },
              ].map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative z-30 inline-block cursor-pointer underline-offset-2 transition-colors hover:text-slate-100 hover:underline"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-4 text-[1.35rem] font-semibold">Contact Us</div>
            <div className="text-sm text-slate-300">
              <div className="mb-1.5">Email Address</div>
              <div className="mb-4 text-sm text-slate-200">info@aussivo.com</div>
              <div className="mb-2 text-sm font-medium text-slate-300">Social</div>
              <SocialLinksRow className="justify-start" />
            </div>
          </div>

          <div className="relative z-0 min-w-0 overflow-hidden lg:pl-2">
            <div className="mb-2 break-words text-2xl font-semibold sm:text-3xl lg:text-4xl">
              Subscribe to Newsletter
            </div>
            <p className="mb-6 text-sm text-slate-300">Receive updates and offers designed just for you.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="email"
                placeholder="Email Address"
                className="input-field !h-[56px] !rounded-xl !px-5 !py-0 !text-base"
              />
              <button type="button" className="btn-primary !h-[56px] shrink-0 !rounded-xl !px-7 !text-base">
                SUBSCRIBE
              </button>
            </div>
          </div>
        </div>

        {/* On-chain: live network status + verifiable deployed contracts */}
        <div className="flex flex-col gap-4 border-b border-slate-600/30 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-200">On-chain</span>
            <OnChainTicker />
            <KrystalVerichainsStrip />
          </div>
          {CONTRACTS.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">Contracts</span>
              {CONTRACTS.map((c) => (
                <div key={c.label} className="group inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px]" title={c.note}>
                  <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span className="text-slate-300">{c.label}</span>
                  <a href={explorerAddress(c.address)} target="_blank" rel="noreferrer" className="font-mono text-slate-400 hover:text-brand">{shortAddr(c.address)}</a>
                  <button onClick={() => { navigator.clipboard?.writeText(c.address); toast.success(`${c.label} address copied`); }} className="text-slate-500 hover:text-brand" aria-label={`Copy ${c.label} address`}>
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-sm text-slate-300 sm:flex-row">
          <div className="text-center sm:text-left">&copy; 2026 Aussivo. All Rights Reserved.</div>
          <div className="flex items-center gap-3">
            <span>Terms of use</span>
            <span className="text-slate-500">|</span>
            <span>Privacy Policy</span>
          </div>
        </div>
      </div>
    </footer>
  );
}