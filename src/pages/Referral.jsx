import { useEffect, useState } from "react";
import { useWeb3 } from "../context/Web3Context";
import toast from "react-hot-toast";

const API = "http://localhost:4000";

export default function Referral() {
  const { token, user } = useWeb3();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/user/referrals`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setData(d.data)).catch(() => {});
  }, [token]);

  const refLink = data?.referralLink || (user?.referralCode ? `${window.location.origin}?ref=${user.referralCode}` : "");

  const copyLink = () => {
    navigator.clipboard.writeText(refLink);
    toast.success("Referral link copied!");
  };

  if (!token) return (
    <div className="max-w-4xl mx-auto px-6 py-20 text-center">
      <h2 className="font-display font-bold text-2xl mb-4">Sign In Required</h2>
      <p className="text-muted mb-6">Connect wallet and verify email to access your referral dashboard.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="font-display font-bold text-3xl mb-2">Referral Program</h1>
      <p className="text-muted mb-8">Earn commissions from your network's yield earnings</p>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="glass p-5 text-center">
          <div className="text-3xl font-display font-bold text-brand">{data?.l1?.count || 0}</div>
          <div className="text-xs text-muted mt-1">Level 1 Referrals</div>
          <div className="text-xs text-brand/60 mt-0.5">{data?.l1?.commissionRate || "0.35%"} commission</div>
        </div>
        <div className="glass p-5 text-center">
          <div className="text-3xl font-display font-bold text-blue-400">{data?.l2?.count || 0}</div>
          <div className="text-xs text-muted mt-1">Level 2 Referrals</div>
          <div className="text-xs text-blue-400/60 mt-0.5">{data?.l2?.commissionRate || "0.15%"} commission</div>
        </div>
        <div className="glass p-5 text-center">
          <div className="text-3xl font-display font-bold">${(data?.totalEarnings || 0).toFixed(2)}</div>
          <div className="text-xs text-muted mt-1">Total Earned</div>
        </div>
      </div>

      <div className="glass p-7 mb-6">
        <h3 className="font-display font-semibold text-lg mb-4">Your Referral Link</h3>
        <div className="flex gap-3">
          <input value={refLink} readOnly className="input-field text-sm flex-1" />
          <button onClick={copyLink} className="btn-primary whitespace-nowrap">Copy Link</button>
        </div>
        <p className="text-xs text-muted mt-3">Share this link. When someone signs up and earns yield, you get commissions automatically.</p>
      </div>

      {data?.recentCommissions?.length > 0 && (
        <div className="glass p-7">
          <h3 className="font-display font-semibold text-lg mb-4">Recent Commissions</h3>
          <div className="space-y-2">
            {data.recentCommissions.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-surface-4/30 last:border-0 text-sm">
                <div>
                  <span className={`tag ${c.source === 'referral_l1' ? "tag-green" : "tag-blue"} mr-2 text-[10px]`}>
                    {c.source === 'referral_l1' ? 'L1' : 'L2'}
                  </span>
                  <span className="text-muted text-xs">{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                <span className="font-semibold text-brand">+${c.amount?.toFixed(4)} {c.asset}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
