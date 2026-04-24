import brandLogo from "../assets/branding/logo-aussivo.png";

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-surface-3/50 mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_1.8fr] gap-10 pb-10 border-b border-surface-3/50">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <img src={brandLogo} alt="Aussivo.DEX" className="h-8 w-auto" />
            </div>
            <p className="text-xs text-muted">Empowering Your Decentralized Future</p>
          </div>

          <div>
            <div className="text-[1.35rem] font-semibold mb-4">Products</div>
            <div className="space-y-2.5 text-sm text-slate-300">
              <div>Live Demo</div>
              <div>Architecture</div>
              <div>Documentation</div>
            </div>
          </div>

          <div>
            <div className="text-[1.35rem] font-semibold mb-4">Company</div>
            <div className="space-y-2.5 text-sm text-slate-300">
              <div>About</div>
              <div>Blogs</div>
              <div>Contact</div>
            </div>
          </div>

          <div>
            <div className="text-[1.35rem] font-semibold mb-4">Contact Us</div>
            <div className="text-sm text-slate-300">
              <div className="mb-1.5">Email Address</div>
              <div className="text-sm text-slate-200 mb-3">info@aussivo.com</div>
              <div className="flex items-center gap-3 text-brand text-sm">
                <span>◉</span>
                <span>◎</span>
                <span>✕</span>
                <span>◈</span>
                <span>▣</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-4xl font-semibold mb-2">Subscribe to Newsletter</div>
            <p className="text-sm text-slate-300 mb-6">Receive updates and offers designed just for you.</p>
            <div className="flex items-center gap-3">
              <input
                type="email"
                placeholder="Email Address"
                className="input-field !h-[56px] !py-0 !px-5 !text-base !rounded-xl"
              />
              <button className="btn-primary !h-[56px] !px-7 !text-base !rounded-xl">SUBSCRIBE</button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 text-sm text-slate-300">
          <div>&copy; 2026 Aussivo. All Rights Reserved.</div>
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
