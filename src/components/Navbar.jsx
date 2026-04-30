import { Link, useLocation } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { useState, useEffect } from "react";
import AuthModal from "./AuthModal";
import brandLogo from "../assets/branding/logo-aussivo.png";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/pools", label: "Earn" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/referral", label: "Referral" },
];

export default function Navbar() {
  const { account, short, disconnect, user, isLoggedIn, connectWallet } = useWeb3();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => { if (isLoggedIn) setShowAuth(false); }, [isLoggedIn]);

  const handleConnect = async () => {
    const addr = await connectWallet();
    if (!addr) return; // user rejected the wallet prompt — don't open sign-in
    setShowAuth(true);
  };

  return (
    <>
      <header className="relative z-50">
        <div className="max-w-7xl mx-auto px-6 h-[74px] flex items-center justify-between">
          <Link to="/" className="group">
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
                    <Link to="/swap" className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-surface-3 rounded-lg" onClick={() => setMenuOpen(false)}>🔄 Swap</Link>
                    <Link to="/referral" className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-surface-3 rounded-lg" onClick={() => setMenuOpen(false)}>🤝 Referrals</Link>
                    <button onClick={() => { disconnect(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-surface-3 rounded-lg mt-1 border-t border-surface-4/50 pt-2">⏏ Sign out</button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={handleConnect} className="btn-primary !rounded-full !px-6 !py-2.5 !text-[0.8rem] !font-semibold tracking-wide">
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
    </>
  );
}
