import { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";

const API = "http://localhost:4000";
const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem("admin_token")}` });

export default function AdminReferrals() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/admin/referral-stats`, { headers: hdr() }).then(r => r.json()).then(d => setData(d.data));
  }, []);

  const l1Stats = data?.totalReferralPaid?.find(s => s._id === "referral_l1");
  const l2Stats = data?.totalReferralPaid?.find(s => s._id === "referral_l2");

  return (
    <AdminLayout title="Referral Stats">
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="glass p-5 text-center">
          <div className="text-xs text-muted mb-1 uppercase tracking-wider">L1 Commissions Paid</div>
          <div className="text-2xl font-display font-bold text-brand">${(l1Stats?.total || 0).toFixed(2)}</div>
          <div className="text-xs text-muted mt-1">{l1Stats?.count || 0} payments · 0.35% rate</div>
        </div>
        <div className="glass p-5 text-center">
          <div className="text-xs text-muted mb-1 uppercase tracking-wider">L2 Commissions Paid</div>
          <div className="text-2xl font-display font-bold text-blue-400">${(l2Stats?.total || 0).toFixed(2)}</div>
          <div className="text-xs text-muted mt-1">{l2Stats?.count || 0} payments · 0.15% rate</div>
        </div>
        <div className="glass p-5 text-center">
          <div className="text-xs text-muted mb-1 uppercase tracking-wider">Total Referral Cost</div>
          <div className="text-2xl font-display font-bold">${((l1Stats?.total || 0) + (l2Stats?.total || 0)).toFixed(2)}</div>
        </div>
      </div>

      <div className="glass p-6">
        <h3 className="font-display font-semibold text-lg mb-4">Top Referrers</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-muted border-b border-surface-4">
            <th className="text-left pb-3">#</th><th className="text-left pb-3">User</th><th className="text-left pb-3">Code</th>
            <th className="text-right pb-3">Earnings</th><th className="text-right pb-3">Deposited</th>
          </tr></thead>
          <tbody>
            {(data?.topReferrers || []).map((r, i) => (
              <tr key={r._id} className="border-b border-surface-4/20">
                <td className="py-3 text-muted">{i + 1}</td>
                <td className="py-3"><div className="font-medium">{r.name}</div><div className="text-xs text-muted">{r.email}</div></td>
                <td className="py-3 text-xs font-mono text-brand">{r.referralCode}</td>
                <td className="py-3 text-right font-semibold text-brand">${r.referralEarnings?.toFixed(2)}</td>
                <td className="py-3 text-right">${r.totalDeposited?.toFixed(0)}</td>
              </tr>
            ))}
            {!data?.topReferrers?.length && <tr><td colSpan={5} className="py-8 text-center text-muted">No referral data yet</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
