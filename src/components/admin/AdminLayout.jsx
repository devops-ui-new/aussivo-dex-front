import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" },
  { to: "/admin/vaults", label: "Vaults", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { to: "/admin/users", label: "Users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { to: "/admin/deposits", label: "Deposits", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { to: "/admin/yield-logs", label: "APY Logs", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { to: "/admin/referrals", label: "Referrals", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
];

export default function AdminLayout({ children, title }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem("admin_token");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!token && pathname !== "/admin/login") navigate("/admin/login");
  }, [token, pathname, navigate]);

  if (!token && pathname !== "/admin/login") return null;

  return (
    <div className="flex min-h-screen bg-[#060b18]">
      {/* ═══ SIDEBAR ═══ */}
      <aside className={`fixed top-0 left-0 h-full z-50 bg-[#0b1121] border-r border-surface-4/40 flex flex-col transition-all duration-300 ${collapsed ? "w-[68px]" : "w-[240px]"}`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-surface-4/40">
          <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2.5"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" /></svg>
          </div>
          {!collapsed && (
            <div className="ml-3">
              <div className="font-display font-bold text-sm text-white">Aussivo<span className="text-brand">.DEX</span></div>
              <div className="text-[10px] text-muted -mt-0.5">Admin Console</div>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {NAV.map(n => {
            const active = pathname === n.to;
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  active
                    ? "bg-brand/10 text-brand border border-brand/15"
                    : "text-slate-400 hover:text-slate-200 hover:bg-surface-3/50 border border-transparent"
                }`}
                title={collapsed ? n.label : undefined}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke={active ? "#00e676" : "#64748b"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  className="flex-shrink-0 group-hover:stroke-slate-300">
                  <path d={n.icon} />
                </svg>
                {!collapsed && <span>{n.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-surface-4/40 space-y-2">
          <button onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-muted hover:text-slate-300 hover:bg-surface-3/50 transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${collapsed ? "rotate-180" : ""}`}>
              <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7"/>
            </svg>
            {!collapsed && "Collapse"}
          </button>
          <button onClick={() => { localStorage.removeItem("admin_token"); navigate("/admin/login"); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            {!collapsed && "Sign Out"}
          </button>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className={`flex-1 transition-all duration-300 ${collapsed ? "ml-[68px]" : "ml-[240px]"}`}>
        {/* Top Bar */}
        <div className="h-16 border-b border-surface-4/40 flex items-center justify-between px-8 bg-[#0b1121]/50 backdrop-blur-sm sticky top-0 z-40">
          <h1 className="font-display font-bold text-lg text-white">{title || "Dashboard"}</h1>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-300 font-medium">Super Admin</div>
              <div className="text-[10px] text-muted">admin@aussivo.com</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-brand/15 border border-brand/20 flex items-center justify-center text-brand text-xs font-bold">SA</div>
          </div>
        </div>

        {/* Page Content */}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
