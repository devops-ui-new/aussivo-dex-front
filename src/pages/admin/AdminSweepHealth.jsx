import { useEffect, useState, useCallback } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import toast from "react-hot-toast";
import { API } from "../../config/api";

const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem("admin_token")}`, "Content-Type": "application/json" });

function Dot({ ok }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"} ${ok ? "" : "animate-pulse"}`} />;
}

function Stat({ label, value, tone = "slate" }) {
  const tones = {
    slate: "text-slate-100", amber: "text-amber-300", red: "text-red-300", green: "text-emerald-300", blue: "text-blue-300",
  };
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-center">
      <div className={`text-2xl font-bold ${tones[tone]}`}>{value}</div>
      <div className="text-[11px] text-slate-400 mt-1">{label}</div>
    </div>
  );
}

function FunderCard({ label, funder, unit, blocking }) {
  if (!funder) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
        <div className="text-xs text-slate-400 mb-1">{label} gas funder</div>
        <div className="text-sm text-slate-500">Not configured</div>
      </div>
    );
  }
  return (
    <div className={`rounded-xl border p-4 ${blocking ? "border-red-500/40 bg-red-500/5" : "border-slate-700/50 bg-slate-800/40"}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-slate-400">{label} gas funder</div>
        <div className="flex items-center gap-1.5 text-xs">
          <Dot ok={funder.ok} />
          <span className={funder.ok ? "text-emerald-300" : "text-red-300"}>{funder.ok ? "Healthy" : "Low"}</span>
        </div>
      </div>
      <div className="text-xl font-bold text-slate-100">{funder.balance} {unit}</div>
      <div className="text-[11px] font-mono text-slate-500 mt-1 break-all">{funder.address}</div>
      {blocking && <div className="text-[11px] text-red-300 mt-2">⚠ Funder too low — deposits can't sweep. Top it up.</div>}
    </div>
  );
}

function ChainPanel({ title, chain, unit, onForce, forcing }) {
  if (!chain) return null;
  const funder = chain.gasFunder
    ? { address: chain.gasFunder.address, balance: chain.gasFunder[unit === "BNB" ? "bnb" : "trx"], ok: chain.gasFunder.ok }
    : null;
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5">
      <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Awaiting deposit" value={chain.awaitingDeposit} />
        <Stat label="Awaiting sweep" value={chain.awaitingSweep} tone={chain.awaitingSweep ? "amber" : "slate"} />
        <Stat label="Swept" value={chain.swept} tone="green" />
        <Stat label="Stuck > 3m" value={chain.stuckCount} tone={chain.stuckCount ? "red" : "slate"} />
      </div>

      <FunderCard label={title} funder={funder} unit={unit} blocking={chain.funderBlocking} />

      {chain.stuck?.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Stuck deposits</div>
          <div className="space-y-2">
            {chain.stuck.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-700/40 bg-slate-800/30 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-mono text-slate-200 truncate">{s.address}</div>
                  <div className="text-[11px] text-slate-500">
                    {s.amount} {s.asset} · waiting {s.waitingMinutes ?? "?"}m
                    {s.lastFundedAt ? ` · funded ${new Date(s.lastFundedAt).toLocaleTimeString()}` : " · never funded"}
                  </div>
                </div>
                <button
                  onClick={() => onForce(s.id)}
                  disabled={forcing === s.id}
                  className="shrink-0 rounded-lg bg-brand/90 hover:bg-brand px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50"
                >
                  {forcing === s.id ? "Sweeping…" : "Force sweep"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {chain.stuck?.length === 0 && (
        <div className="mt-4 text-center text-xs text-slate-500 py-3">No stuck deposits 🎉</div>
      )}
    </div>
  );
}

export default function AdminSweepHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forcing, setForcing] = useState(null);

  const load = useCallback(() => {
    fetch(`${API}/api/admin/sweep-status`, { headers: hdr() })
      .then(r => r.json())
      .then(d => { setData(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000); // auto-refresh
    return () => clearInterval(iv);
  }, [load]);

  const forceSweep = async (pendingId) => {
    setForcing(pendingId);
    try {
      const res = await fetch(`${API}/api/admin/sweep-status/force`, {
        method: "POST", headers: hdr(), body: JSON.stringify({ pendingId }),
      });
      const d = await res.json();
      if (d.status === 200 && d.data?.swept) toast.success("Swept to treasury ✓");
      else if (d.status === 200) toast(d.message || "Retry triggered", { icon: "⏳" });
      else toast.error(d.message || "Force sweep failed");
      load();
    } catch { toast.error("Force sweep failed"); }
    setForcing(null);
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Sweep Health</h1>
            <p className="text-sm text-slate-400 mt-1">In-flight and stuck deposits, and gas-funder status. Auto-refreshes every 15s.</p>
          </div>
          <button onClick={load} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
            ↻ Refresh
          </button>
        </div>

        {loading && !data ? (
          <div className="text-center text-slate-500 py-20">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChainPanel title="BSC (BEP-20)" chain={data?.bep20} unit="BNB" onForce={forceSweep} forcing={forcing} />
            <ChainPanel title="Tron (TRC-20)" chain={data?.trc20} unit="TRX" onForce={forceSweep} forcing={forcing} />
          </div>
        )}

        {data?.generatedAt && (
          <div className="text-center text-[11px] text-slate-600 mt-6">Last updated {new Date(data.generatedAt).toLocaleTimeString()}</div>
        )}
      </div>
    </AdminLayout>
  );
}