import { Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Navbar from "./components/Navbar";
import WalletPromptModal from "./components/WalletPromptModal";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Pools from "./pages/Pools";
import PoolDetail from "./pages/PoolDetail";
import Portfolio from "./pages/Portfolio";
import Swap from "./pages/Swap";
import Perps from "./pages/Perps";
import Referral from "./pages/Referral";
import DepositQR from "./pages/DepositQR";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminVaults from "./pages/admin/AdminVaults";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminDeposits from "./pages/admin/AdminDeposits";
import AdminChainHealth from "./pages/admin/AdminChainHealth";
import AdminSweepHealth from "./pages/admin/AdminSweepHealth";
import AdminDepositAddresses from "./pages/admin/AdminDepositAddresses";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminYieldLogs from "./pages/admin/AdminYieldLogs";
import AdminReferrals from "./pages/admin/AdminReferrals";


/**
 * Site-wide maintenance banner. Purely presentational — it touches no deposit, sweep or
 * API logic. To take it down later, delete this component and the <MaintenanceBanner />
 * line below. Hidden on /admin so the team can keep working.
 */
function MaintenanceBanner() {
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 200,
      background: "linear-gradient(90deg,#3a2a00,#5a3d00)",
      borderBottom: "1px solid rgba(255,193,7,0.35)",
      color: "#ffe08a", fontSize: 14, lineHeight: 1.5,
      padding: "10px 16px", textAlign: "center",
      fontFamily: "system-ui,-apple-system,sans-serif",
    }}>
      <strong style={{ color: "#ffc107" }}>⚠ Network issue.</strong>{" "}
      Deposits are temporarily paused due to a blockchain network issue. Please try again in a few hours.
    </div>
  );
}

// Navbar height — the terminal takes exactly the viewport left below it.
const NAV_H = 74;

export default function App() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");
  // The perp terminal is full-bleed: it keeps the Navbar, drops the Footer, and
  // owns its own scrolling (the panel grid must not grow the page).
  const isTerminal = pathname.startsWith("/perps");

  return (
    <div className={`flex flex-col ${isTerminal ? "h-screen overflow-hidden" : "min-h-screen"}`}>
      {!isAdmin && <MaintenanceBanner />}
      {!isAdmin && <><div className="bg-mesh" /><div className="bg-grid" /><Navbar />{!isTerminal && <WalletPromptModal />}</>}
      <main
        className={`flex-1 ${!isAdmin ? "relative z-10" : ""} ${isTerminal ? "min-h-0 overflow-hidden" : ""}`}
        style={isTerminal ? { height: `calc(100vh - ${NAV_H}px)` } : undefined}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pools" element={<Pools />} />
          <Route path="/pool/:id" element={<PoolDetail />} />
          <Route path="/swap" element={<Swap />} />
          <Route path="/perps" element={<Perps />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/referral" element={<Referral />} />
          {/* <Route path="/deposit/:vaultId" element={<DepositQR />} /> */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/vaults" element={<AdminVaults />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/deposits" element={<AdminDeposits />} />
          <Route path="/admin/sweep-health" element={<AdminSweepHealth />} />
          <Route path="/admin/deposit-addresses" element={<AdminDepositAddresses />} />
          <Route path="/admin/chain-health" element={<AdminChainHealth />} />
          <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
          <Route path="/admin/yield-logs" element={<AdminYieldLogs />} />
          <Route path="/admin/referrals" element={<AdminReferrals />} />
        </Routes>
      </main>
      {!isAdmin && !isTerminal && <Footer />}
      <Toaster position="bottom-right" toastOptions={{
        style: { background: "#111827", color: "#e2e8f0", border: "1px solid rgba(0,230,118,0.15)", borderRadius: "12px", fontFamily: "DM Sans" },
        success: { iconTheme: { primary: "#00e676", secondary: "#060b18" } },
      }} />
    </div>
  );
}