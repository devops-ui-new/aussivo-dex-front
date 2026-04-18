import { Link, useLocation } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { useState, useEffect } from "react";
import AuthModal from "./AuthModal";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/pools", label: "Earn" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/referral", label: "Referral" },
];

export default function Navbar() {
  const { account, short, disconnect, user, isLoggedIn, needsRegistration, connectWallet } = useWeb3();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // Show registration modal ONLY when wallet connected but user not registered
  useEffect(() => {
    if (needsRegistration && !isLoggedIn) setShowAuth(true);
    if (isLoggedIn) setShowAuth(false);
  }, [needsRegistration, isLoggedIn]);

  const handleConnect = async () => {
    if (!window.ethereum) { setShowAuth(true); return; }
    // Connect wallet — Web3Context handles the rest:
    // If returning user → auto-login (no modal)
    // If new user → sets needsRegistration → triggers modal above
    await connectWallet();
  };

  return (
    <>
      <header className="relative z-50 border-b border-surface-3/60">
        <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center group-hover:bg-brand/20 transition-all">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2.5">
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                <line x1="12" y1="22" x2="12" y2="15.5" />
                <polyline points="22 8.5 12 15.5 2 8.5" />
              </svg>
            </div>
            <span className="font-display font-bold text-lg tracking-tight">Aussivo<span className="text-brand">.DEX</span></span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(n => (
              <Link key={n.to} to={n.to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname === n.to ? "text-brand bg-brand/8" : "text-slate-400 hover:text-slate-200 hover:bg-surface-3/50"
                }`}>{n.label}</Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <div className="relative">
                <button onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-3 bg-surface-3/80 border border-surface-4 px-4 py-2.5 rounded-xl hover:border-brand/20 transition-all">
                  <div className="pulse-dot" />
                  <div className="text-left">
                    <div className="text-sm font-medium font-display">{user?.name || "User"}</div>
                    <div className="text-[10px] text-muted -mt-0.5">{user?.email || short}</div>
                  </div>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-60 glass p-2 shadow-2xl" style={{ animation: "modalIn 0.15s ease-out" }}>
                    <div className="px-3 py-2.5 mb-1 border-b border-surface-4/50">
                      <div className="text-sm font-medium truncate text-white">{user?.name}</div>
                      <div className="text-[11px] text-muted">{user?.email}</div>
                      {user?.referralCode && <div className="text-[10px] text-brand font-mono font-bold mt-1">REF: {user.referralCode}</div>}
                      {account && <div className="text-[10px] text-muted font-mono mt-0.5">{short}</div>}
                    </div>
                    <Link to="/portfolio" className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-surface-3 rounded-lg" onClick={() => setMenuOpen(false)}>📊 Portfolio</Link>
                    <Link to="/referral" className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-surface-3 rounded-lg" onClick={() => setMenuOpen(false)}>🤝 Referrals</Link>
                    <button onClick={() => { disconnect(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-surface-3 rounded-lg mt-1 border-t border-surface-4/50 pt-2">⏏ Disconnect</button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={handleConnect} className="btn-primary text-sm flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M22 10h-6a2 2 0 000 4h6"/>
                </svg>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Registration modal — ONLY for new users */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
    </>
  );
}
