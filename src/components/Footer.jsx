import brandLogo from "../assets/branding/logo-aussivo.png";
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
    href: "https://www.linkedin.com/checkpoint/challenge/AgGg59dE-HE30wAAAZ4We1QHr-TC3ut3p5km2r0EFETU84VAx5lRZN05RxvcYWas-miZA5pieFRsV1Aqjms5mgwhEbx-Iw?ut=2VHqNYTf9oiYg1",
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
        <div className="grid min-w-0 gap-10 border-b border-slate-600/30 pb-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_1.8fr]">
          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <img src={brandLogo} alt="Aussivo.DEX" className="h-8 w-auto" />
            </div>
            <p className="text-xs text-muted">Empowering Your Decentralized Future</p>
          </div>

          <div>
            <div className="mb-4 text-[1.35rem] font-semibold">Products</div>
            <div className="space-y-2.5 text-sm text-slate-300">
              <div>Live Demo</div>
              <div>Architecture</div>
              <div>Documentation</div>
            </div>
          </div>

          <div className="relative z-20 min-w-0">
            <div className="mb-4 text-[1.35rem] font-semibold">Company</div>
            <div className="space-y-2.5 text-sm text-slate-300">
              <div>About</div>
              <a
                href="https://aussivo.com/blog"
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-30 inline-block cursor-pointer underline-offset-2 transition-colors hover:text-slate-100 hover:underline"
              >
                Blogs
              </a>
              <div>Contact</div>
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
