import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import toast from "react-hot-toast";

import { API } from "../../config/api";
const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem("admin_token")}`, "Content-Type": "application/json" });

const EMPTY_FORM = { name: "", description: "", asset: "USDT", vaultType: "locked", lockDays: 30, durationMonths: 12, minDeposit: 50, maxDeposit: 100000, capacity: 5000000, earlyExitFeeBps: 500, displayApy: 18, tiers: [{ minAmount: 50, maxAmount: 5000, apyPercent: 1 }, { minAmount: 5000, maxAmount: 50000, apyPercent: 1.25 }, { minAmount: 50000, maxAmount: 1000000, apyPercent: 1.5 }], strategies: [{ name: "Aave V3", allocation: 40, protocol: "aave" }, { name: "Reserve", allocation: 60, protocol: "reserve" }] };

export default function AdminVaults() {
  const navigate = useNavigate();
  const [vaults, setVaults] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`${API}/api/admin/vaults`, { headers: hdr() });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("admin_token");
        toast.error("Session expired, please log in again");
        navigate("/admin/login");
        return;
      }
      const d = await res.json();
      setVaults(Array.isArray(d.data) ? d.data : []);
    } catch (e) {
      toast.error("Failed to load vaults");
    }
  };
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const url = editId ? `${API}/api/admin/vaults/${editId}` : `${API}/api/admin/vaults`;
      const method = editId ? "PUT" : "POST";
      const payload = { ...form, displayApy: form.displayApy === "" || form.displayApy == null ? null : Number(form.displayApy) };
      const res = await fetch(url, { method, headers: hdr(), body: JSON.stringify(payload) });
      const d = await res.json();
      if (d.status === 200 || d.status === 201) {
        toast.success(editId ? "Vault updated" : "Vault created");
        setShowForm(false); setEditId(null); setForm({ ...EMPTY_FORM }); load();
      } else toast.error(d.message);
    } catch { toast.error("Failed"); }
    setLoading(false);
  };

  const editVault = (v) => {
    setForm({ name: v.name, description: v.description || "", asset: v.asset, vaultType: v.vaultType, lockDays: v.lockDays, durationMonths: v.durationMonths, minDeposit: v.minDeposit, maxDeposit: v.maxDeposit, capacity: v.capacity, earlyExitFeeBps: v.earlyExitFeeBps, displayApy: v.displayApy ?? "", tiers: v.tiers, strategies: v.strategies || [] });
    setEditId(v._id); setShowForm(true);
  };

  const toggleStatus = async (v) => {
    const newStatus = v.status === "active" ? "paused" : "active";
    await fetch(`${API}/api/admin/vaults/${v._id}`, { method: "PUT", headers: hdr(), body: JSON.stringify({ status: newStatus }) });
    toast.success(`Vault ${newStatus}`); load();
  };

  return (
    <AdminLayout title="Vault Management">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-bold text-xl">Vaults ({vaults.length})</h2>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ ...EMPTY_FORM }); }} className="btn-primary text-sm">
          {showForm ? "Cancel" : "+ Create Vault"}
        </button>
      </div>

      {showForm && (
        <div className="glass p-6 mb-6 space-y-4">
          <h3 className="font-display font-semibold">{editId ? "Edit Vault" : "Create New Vault"}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div><label className="text-xs text-muted mb-1 block">Name</label><input value={form.name} onChange={e => set("name", e.target.value)} className="input-field text-sm" /></div>
            <div><label className="text-xs text-muted mb-1 block">Asset</label><select value={form.asset} onChange={e => set("asset", e.target.value)} className="input-field text-sm"><option>USDT</option><option>USDC</option></select></div>
            <div><label className="text-xs text-muted mb-1 block">Type</label><select value={form.vaultType} onChange={e => set("vaultType", e.target.value)} className="input-field text-sm"><option value="locked">Locked</option><option value="flexible">Flexible</option></select></div>
            <div><label className="text-xs text-muted mb-1 block">Lock (days)</label><input type="number" value={form.lockDays} onChange={e => set("lockDays", +e.target.value)} className="input-field text-sm" /></div>
            <div><label className="text-xs text-muted mb-1 block">Duration (months)</label><input type="number" value={form.durationMonths} onChange={e => set("durationMonths", +e.target.value)} className="input-field text-sm" /></div>
            <div><label className="text-xs text-muted mb-1 block">Capacity ($)</label><input type="number" value={form.capacity} onChange={e => set("capacity", +e.target.value)} className="input-field text-sm" /></div>
            <div><label className="text-xs text-muted mb-1 block">Min Deposit</label><input type="number" value={form.minDeposit} onChange={e => set("minDeposit", +e.target.value)} className="input-field text-sm" /></div>
            <div><label className="text-xs text-muted mb-1 block">Max Deposit</label><input type="number" value={form.maxDeposit} onChange={e => set("maxDeposit", +e.target.value)} className="input-field text-sm" /></div>
            <div><label className="text-xs text-muted mb-1 block">Early Exit Fee (bps)</label><input type="number" value={form.earlyExitFeeBps} onChange={e => set("earlyExitFeeBps", +e.target.value)} className="input-field text-sm" /></div>
            <div><label className="text-xs text-muted mb-1 block">Display APY % (public)</label><input type="number" step="0.01" placeholder="Blank = tier-based" value={form.displayApy ?? ""} onChange={e => set("displayApy", e.target.value === "" ? "" : +e.target.value)} className="input-field text-sm" /></div>
          </div>
          <div><label className="text-xs text-muted mb-1 block">Description</label><input value={form.description} onChange={e => set("description", e.target.value)} className="input-field text-sm" /></div>

          <div>
            <label className="text-xs text-muted mb-2 block">APY Tiers</label>
            {form.tiers.map((t, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input type="number" placeholder="Min $" value={t.minAmount} onChange={e => { const tiers = [...form.tiers]; tiers[i].minAmount = +e.target.value; set("tiers", tiers); }} className="input-field text-sm flex-1" />
                <input type="number" placeholder="Max $" value={t.maxAmount} onChange={e => { const tiers = [...form.tiers]; tiers[i].maxAmount = +e.target.value; set("tiers", tiers); }} className="input-field text-sm flex-1" />
                <input type="number" placeholder="APY %" step="0.01" value={t.apyPercent} onChange={e => { const tiers = [...form.tiers]; tiers[i].apyPercent = +e.target.value; set("tiers", tiers); }} className="input-field text-sm flex-1" />
                <button onClick={() => { const tiers = form.tiers.filter((_, j) => j !== i); set("tiers", tiers); }} className="text-red-400 text-xs px-2">✕</button>
              </div>
            ))}
            <button onClick={() => set("tiers", [...form.tiers, { minAmount: 0, maxAmount: 0, apyPercent: 0 }])} className="text-xs text-brand hover:underline">+ Add Tier</button>
          </div>

          <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full py-3 disabled:opacity-50">
            {loading ? "Saving..." : editId ? "Update Vault" : "Create Vault"}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {vaults.map(v => (
          <div key={v._id} className="glass p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${v.status === "active" ? "bg-brand" : "bg-red-400"}`} />
              <div>
                <div className="font-semibold">{v.name} <span className="text-xs text-muted ml-2">{v.asset} · {v.vaultType}</span></div>
                <div className="text-xs text-muted mt-0.5">TVL: ${v.totalStaked?.toLocaleString()} · Users: {v.totalUsers} · Tiers: {v.tiers?.length} · Lock: {v.lockDays}d · Duration: {v.durationMonths}mo</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => editVault(v)} className="text-xs text-blue-400 border border-blue-400/20 px-3 py-1.5 rounded-lg hover:bg-blue-400/10">Edit</button>
              <button onClick={() => toggleStatus(v)} className={`text-xs px-3 py-1.5 rounded-lg border ${v.status === "active" ? "text-red-400 border-red-400/20 hover:bg-red-400/10" : "text-brand border-brand/20 hover:bg-brand/10"}`}>
                {v.status === "active" ? "Pause" : "Activate"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
