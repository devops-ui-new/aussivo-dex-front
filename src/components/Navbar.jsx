import { Link, useLocation, useNavigate } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import AuthModal from "./AuthModal";
import Avatar from "./Avatar";
import { CHAIN, explorerAddress } from "../config/chain";
import brandLogo from "../assets/branding/logo-aussivo.png";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/pools", label: "Earn" },
  { to: "/swap", label: "Swap" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/referral", label: "Referral" },
];

export default function Navbar() {
  const { account, short, disconnect, user, isLoggedIn, connectWallet, chainId } = useWeb3();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => { if (isLoggedIn) setShowAuth(false); }, [isLoggedIn]);
  useEffect(() => { setNavOpen(false); setMenuOpen(false); }, [pathname]); // close menus on navigation

  const closeAuth = useCallback(() => setShowAuth(false), []);

  const handleConnect = async () => {
    if (connecting) return; // ignore repeat clicks while a request is already open
    setConnecting(true);
    try {
      const addr = await connectWallet();
      if (addr) setShowAuth(true); // else: rejected / already-pending — connectWallet already notified
    } finally {
      setConnecting(false);
    }
  };

  return (
    <>
      <header className="relative z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[74px] flex items-center justify-between gap-2">
          <Link to="/" className="group shrink-0">
            <img src={brandLogo} alt="Aussivo.DEX" className="h-8 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-16">
            {NAV.map(n => (
              <Link key={n.to} to={n.to}
                className={`text-sm font-medium transition-colors ${
                  pathname === n.to ? "text-white" : "text-slate-300 hover:text-white"
                }`}>{n.label}</Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {isLoggedIn ? (
              <div className="relative">
                <button onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2.5 bg-surface-3/80 border border-surface-4 pl-2 pr-2 sm:pr-3.5 py-1.5 rounded-xl hover:border-brand/20 transition-all">
                  {account
                    ? <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10 bg-surface-4"><Avatar seed={account} style="bottts" size={32} radius={20} className="h-full w-full" /></div>
                    : <div className="pulse-dot" />}
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium font-display leading-tight">{user?.name || "User"}</div>
                    <div className="flex items-center gap-1 -mt-0.5">
                      {account && (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-semibold ${chainId === CHAIN.id ? "text-emerald-400" : "text-amber-400"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${chainId === CHAIN.id ? "bg-emerald-400" : "bg-amber-400"}`} />
                          {chainId === CHAIN.id ? CHAIN.short : "Wrong network"}
                        </span>
                      )}
                      <span className="text-[10px] text-muted font-mono">{user?.email && !account ? user.email : short}</span>
                    </div>
                  </div>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-60 glass p-2 shadow-2xl" style={{ animation: "modalIn 0.15s ease-out" }}>
                    <div className="px-3 py-2.5 mb-1 border-b border-surface-4/50">
                      <div className="text-sm font-medium truncate text-white">{user?.name}</div>
                      <div className="text-[11px] text-muted">{user?.email}</div>
                      {user?.referralCode && <div className="text-[10px] text-brand font-mono font-bold mt-1">REF: {user.referralCode}</div>}
                      {account && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-300">{short}</span>
                          <button onClick={() => { navigator.clipboard?.writeText(account); toast.success("Address copied"); }} className="text-brand hover:underline text-[10px]">copy</button>
                          <a href={explorerAddress(account)} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-brand">
                            explorer
                            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H8M17 7v9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </a>
                        </div>
                      )}
                    </div>
                    <Link to="/portfolio" className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-surface-3 rounded-lg" onClick={() => setMenuOpen(false)}>📊 Portfolio</Link>
                    <Link to="/referral" className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-surface-3 rounded-lg" onClick={() => setMenuOpen(false)}>🤝 Referrals</Link>
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        await disconnect();
                        navigate("/", { replace: true });
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-surface-3 rounded-lg mt-1 border-t border-surface-4/50 pt-2">⏏ Sign out</button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={handleConnect} disabled={connecting} className="btn-primary !rounded-full !px-4 sm:!px-6 !py-2.5 !text-[0.8rem] !font-semibold tracking-wide disabled:opacity-60 disabled:cursor-not-allowed">
                {connecting ? "Connecting…" : "Connect Wallet"}
              </button>
            )}

            {/* Mobile menu toggle — the main navigation on small screens */}
            <button
              onClick={() => setNavOpen(o => !o)}
              className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-surface-4 bg-surface-3/80 text-slate-200 hover:border-brand/30 hover:text-white transition-colors"
              aria-label={navOpen ? "Close menu" : "Open menu"}
              aria-expanded={navOpen}
            >
              {navOpen ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile navigation drawer */}
        {navOpen && (
          <>
            <div className="md:hidden fixed inset-0 top-[74px] z-40 bg-black/50 backdrop-blur-sm" onClick={() => setNavOpen(false)} />
            <nav className="md:hidden absolute inset-x-0 top-[74px] z-50 border-t border-surface-4/60 bg-surface-1/95 backdrop-blur-xl shadow-2xl" style={{ animation: "navDrop .18s ease-out" }}>
              <div className="max-w-7xl mx-auto px-4 py-3">
                {NAV.map(n => {
                  const active = pathname === n.to;
                  return (
                    <Link key={n.to} to={n.to} onClick={() => setNavOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-base font-semibold transition-colors ${active ? "bg-brand/10 text-brand" : "text-slate-200 hover:bg-surface-3/70"}`}>
                      {n.label}
                      <svg className={`h-4 w-4 ${active ? "text-brand" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </Link>
                  );
                })}
                {isLoggedIn && account && (
                  <div className="mt-2 flex items-center gap-2 border-t border-surface-4/50 px-4 pt-3 text-[11px] text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${chainId === CHAIN.id ? "bg-emerald-400" : "bg-amber-400"}`} />
                    <span className="font-mono">{short}</span>
                    <span className={`ml-auto font-semibold ${chainId === CHAIN.id ? "text-emerald-400" : "text-amber-400"}`}>{chainId === CHAIN.id ? CHAIN.short : "Wrong network"}</span>
                  </div>
                )}
              </div>
            </nav>
          </>
        )}
      </header>

      {showAuth && <AuthModal onClose={closeAuth} />}
      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } } @keyframes navDrop { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </>
  );
}