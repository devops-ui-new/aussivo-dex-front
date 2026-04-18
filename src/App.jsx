import { Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Pools from "./pages/Pools";
import PoolDetail from "./pages/PoolDetail";
import Portfolio from "./pages/Portfolio";
import Referral from "./pages/Referral";
import DepositQR from "./pages/DepositQR";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminVaults from "./pages/admin/AdminVaults";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminDeposits from "./pages/admin/AdminDeposits";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminYieldLogs from "./pages/admin/AdminYieldLogs";
import AdminReferrals from "./pages/admin/AdminReferrals";

export default function App() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <div className="min-h-screen flex flex-col">
      {!isAdmin && <><div className="bg-mesh" /><div className="bg-grid" /><Navbar /></>}
      <main className={`flex-1 ${!isAdmin ? "relative z-10" : ""}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pools" element={<Pools />} />
          <Route path="/pool/:id" element={<PoolDetail />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/referral" element={<Referral />} />
          <Route path="/deposit/:vaultId" element={<DepositQR />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/vaults" element={<AdminVaults />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/deposits" element={<AdminDeposits />} />
          <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
          <Route path="/admin/yield-logs" element={<AdminYieldLogs />} />
          <Route path="/admin/referrals" element={<AdminReferrals />} />
        </Routes>
      </main>
      {!isAdmin && <Footer />}
      <Toaster position="bottom-right" toastOptions={{
        style: { background: "#111827", color: "#e2e8f0", border: "1px solid rgba(0,230,118,0.15)", borderRadius: "12px", fontFamily: "DM Sans" },
        success: { iconTheme: { primary: "#00e676", secondary: "#060b18" } },
      }} />
    </div>
  );
}
