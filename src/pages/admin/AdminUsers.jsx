import { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import UserDetailModal from "../../components/admin/UserDetailModal";
import { API } from "../../config/api";

const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem("admin_token")}` });

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null); // user whose 360° profile modal is open

  const load = () => {
    const q = new URLSearchParams({ page, limit: 20, ...(search && { search }) });
    fetch(`${API}/api/admin/users?${q}`, { headers: hdr() })
      .then((r) => r.json())
      .then((d) => { setUsers(d.data?.users || []); setTotal(d.data?.total || 0); });
  };
  useEffect(load, [page, search]);

  return (
    <AdminLayout title="Users">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Users ({total})</h2>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, email, wallet..." className="input-field w-72 text-sm" />
      </div>

      <div className="glass overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-4 bg-surface-2/30 text-xs text-muted">
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Wallet</th>
              <th className="p-3 text-right">USDT</th>
              <th className="p-3 text-right">Yield</th>
              <th className="p-3 text-right">Deposited</th>
              <th className="p-3 text-right">Ref Earnings</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} onClick={() => setOpenId(u._id)}
                className="cursor-pointer border-b border-surface-4/20 transition-colors hover:bg-surface-2/40">
                <td className="p-3"><div className="font-medium">{u.name}</div><div className="text-xs text-muted">{u.email}</div></td>
                <td className="p-3 font-mono text-xs text-muted">{u.walletAddress ? `${u.walletAddress.slice(0, 8)}...${u.walletAddress.slice(-6)}` : "—"}</td>
                <td className="p-3 text-right">${(u.usdtBalance || 0).toFixed(2)}</td>
                <td className="p-3 text-right text-brand">${((u.yieldWalletUSDT || 0) + (u.yieldWalletUSDC || 0)).toFixed(2)}</td>
                <td className="p-3 text-right">${(u.totalDeposited || 0).toFixed(0)}</td>
                <td className="p-3 text-right">${(u.referralEarnings || 0).toFixed(2)}</td>
                <td className="p-3 text-center"><span className={`tag text-[10px] ${u.status === "active" ? "tag-green" : "tag-red"}`}>{u.status}</span></td>
                <td className="p-3 text-right">
                  <button onClick={(e) => { e.stopPropagation(); setOpenId(u._id); }} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                    View profile
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-sm text-muted">No users found.</td></tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-surface-4/30 p-3">
          <span className="text-xs text-muted">Page {page} · {total} total</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-xs text-muted hover:text-slate-300 disabled:opacity-30">← Prev</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={users.length < 20} className="text-xs text-muted hover:text-slate-300 disabled:opacity-30">Next →</button>
          </div>
        </div>
      </div>

      {openId && <UserDetailModal userId={openId} onClose={() => setOpenId(null)} />}
    </AdminLayout>
  );
}