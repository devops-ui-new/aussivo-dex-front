import { useEffect, useState, useCallback } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import toast from "react-hot-toast";
import { API } from "../../config/api";

const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem("admin_token")}`, "Content-Type": "application/json" });
const fmtUsd = (cents) => `$${(Number(cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTime = (unixOrIso) => {
  if (!unixOrIso) return "—";
  const d = typeof unixOrIso === "number" ? new Date(unixOrIso * 1000) : new Date(unixOrIso);
  return isNaN(d) ? "—" : d.toLocaleString();
};

function Stat({ label, value, tone = "slate", sub }) {
  const tones = { slate: "text-slate-100", amber: "text-amber-300", red: "text-red-300", green: "text-emerald-300", blue: "text-blue-300" };
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-center">
      <div className={`text-2xl font-bold ${tones[tone]}`}>{value}</div>
      <div className="text-[11px] text-slate-400 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AdminChainHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await fetch(`${API}/api/admin/chain-health`, { headers: hdr() }).then((r) => r.json());
      setData(d.data);
    } catch { toast.error("Failed to load chain health"); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const retry = async () => {
    setBusy("retry");
    try {
      const d = await fetch(`${API}/api/admin/chain-health/retry`, { method: "POST", headers: hdr() }).then((r) => r.json());
      toast.success(`Re-queued ${d.data?.requeued ?? 0} failed job(s)`);
      load();
    } catch { toast.error("Retry failed"); }
    setBusy("");
  };

  const reconcile = async (markGlobal) => {
    setBusy(markGlobal ? "reconcile-global" : "reconcile");
    try {
      const d = await fetch(`${API}/api/admin/chain-health/reconcile`, {
        method: "POST", headers: hdr(), body: JSON.stringify({ markGlobal }),
      }).then((r) => r.json());
      const r = d.data || {};
      toast.success(`Reconcile: checked ${r.checked ?? 0}, drift ${r.drifted ?? 0}, re-queued ${r.requeued ?? 0}`);
      load();
    } catch { toast.error("Reconcile failed"); }
    setBusy("");
  };

  if (loading) return <AdminLayout><div className="text-slate-400">Loading…</div></AdminLayout>;

  if (!data?.enabled) {
    return (
      <AdminLayout>
        <h1 className="text-2xl font-bold text-white mb-2">Chain Health</h1>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-amber-200">
          Registry v2 is not configured. Set <code className="font-mono">REGISTRY_V2_ADDRESS</code> and{" "}
          <code className="font-mono">REGISTRY_V2_OWNER_PRIVATE_KEY</code> in the backend env to enable on-chain attestation.
        </div>
      </AdminLayout>
    );
  }

  const s = data.signer || {};
  const ob = data.outbox || {};
  const oc = data.onChain || {};
  const db = data.database || {};
  const rec = data.lastReconcile;

  const driftUsers = oc ? Math.abs((oc.totalUsers || 0) - (db.activeUsers || 0)) : 0;
  const dbPrincipalCents = Math.round((db.activePrincipal || 0) * 100);
  const principalMatch = oc && String(oc.totalPrincipalCents) === String(dbPrincipalCents);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Chain Health</h1>
          <p className="text-sm text-slate-400 mt-0.5">On-chain attestation sync — signer gas, queue, and DB↔chain reconciliation.</p>
        </div>
        <button onClick={load} className="text-xs text-slate-300 border border-slate-600 rounded-lg px-3 py-1.5 hover:bg-slate-800">Refresh</button>
      </div>

      {/* Signer / gas */}
      <div className={`rounded-2xl border p-5 mb-6 ${s.lowGas ? "border-red-500/40 bg-red-500/5" : "border-slate-700/50 bg-slate-900/50"}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white">Attestation signer</h3>
          <span className={`text-xs px-2 py-1 rounded-full ${s.lowGas ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>
            {s.lowGas ? "Low gas" : "Healthy"}
          </span>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <div className="text-[11px] text-slate-400">Owner wallet</div>
            <div className="font-mono text-xs text-slate-200 break-all mt-1">{s.address || "—"}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Gas balance</div>
            <div className={`text-xl font-bold mt-1 ${s.lowGas ? "text-red-300" : "text-slate-100"}`}>
              {s.gasBnb != null ? Number(s.gasBnb).toFixed(5) : "—"} BNB
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Contract</div>
            <div className="font-mono text-xs text-slate-200 break-all mt-1">{data.contract || "—"}</div>
          </div>
        </div>
        {s.lowGas && (
          <div className="mt-3 text-[12px] text-red-300">
            ⚠ Signer below {s.minGasBnb} BNB. Attestations will queue but won't send until it's funded. Top up this wallet.
          </div>
        )}
      </div>

      {/* Outbox queue */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Sync queue (outbox)</h3>
          <button onClick={retry} disabled={busy === "retry" || !(ob.failed > 0)}
            className="text-xs bg-brand/10 text-brand border border-brand/30 rounded-lg px-3 py-1.5 hover:bg-brand/20 disabled:opacity-40">
            {busy === "retry" ? "Re-queuing…" : `Retry failed (${ob.failed || 0})`}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Pending" value={ob.pending || 0} tone={ob.pending ? "amber" : "slate"} />
          <Stat label="Processing" value={ob.processing || 0} tone="blue" />
          <Stat label="Done" value={ob.done || 0} tone="green" />
          <Stat label="Failed" value={ob.failed || 0} tone={ob.failed ? "red" : "slate"} />
        </div>
        {Array.isArray(data.recentFailures) && data.recentFailures.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] text-slate-400 mb-2">Recent failures</div>
            <div className="space-y-1.5">
              {data.recentFailures.map((f, i) => (
                <div key={i} className="text-[11px] rounded-lg bg-slate-800/50 border border-slate-700/40 px-3 py-2">
                  <div className="flex justify-between">
                    <span className="font-mono text-slate-300">{f.walletAddress || f.kind}</span>
                    <span className="text-slate-500">attempt {f.attempts} · {fmtTime(f.updatedAt)}</span>
                  </div>
                  <div className="text-red-300/80 mt-0.5 break-all">{f.lastError}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reconciliation: DB vs chain */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">DB ↔ chain reconciliation</h3>
          <div className="flex gap-2">
            <button onClick={() => reconcile(false)} disabled={busy.startsWith("reconcile")}
              className="text-xs border border-slate-600 text-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-800 disabled:opacity-40">
              {busy === "reconcile" ? "Running…" : "Run reconcile"}
            </button>
            <button onClick={() => reconcile(true)} disabled={busy.startsWith("reconcile")}
              className="text-xs bg-brand/10 text-brand border border-brand/30 rounded-lg px-3 py-1.5 hover:bg-brand/20 disabled:opacity-40">
              {busy === "reconcile-global" ? "Running…" : "Reconcile + stamp global"}
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
            <div className="text-[11px] text-slate-400 mb-2">Database (source of truth)</div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Active users (with wallet)</span><span className="text-slate-100 font-semibold">{db.activeUsers ?? "—"}</span></div>
            <div className="flex justify-between text-sm mt-1"><span className="text-slate-400">Active principal</span><span className="text-slate-100 font-semibold">${(db.activePrincipal || 0).toLocaleString()}</span></div>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
            <div className="text-[11px] text-slate-400 mb-2">On-chain (attested)</div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Registered users</span><span className="text-slate-100 font-semibold">{oc?.totalUsers ?? "—"}</span></div>
            <div className="flex justify-between text-sm mt-1"><span className="text-slate-400">Total principal</span><span className="text-slate-100 font-semibold">{oc ? fmtUsd(oc.totalPrincipalCents) : "—"}</span></div>
            <div className="flex justify-between text-sm mt-1"><span className="text-slate-400">APY on-chain</span><span className="text-slate-100 font-semibold">{oc ? (oc.apyBps / 100).toFixed(2) + "%" : "—"}</span></div>
            <div className="flex justify-between text-sm mt-1"><span className="text-slate-400">Last global sync</span><span className="text-slate-100">{fmtTime(oc?.lastGlobalSyncAt)}</span></div>
          </div>
        </div>

        <div className={`rounded-lg px-3 py-2 text-[12px] ${principalMatch && driftUsers === 0 ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "bg-amber-500/10 text-amber-300 border border-amber-500/20"}`}>
          {principalMatch && driftUsers === 0
            ? "✓ In sync — on-chain aggregate matches the database."
            : `△ Drift detected — principal ${principalMatch ? "matches" : "differs"}, user count off by ${driftUsers}. Run reconcile to re-queue affected users.`}
        </div>

        {rec && (
          <div className="mt-4 text-[11px] text-slate-400">
            Last reconcile: {fmtTime(rec.finishedAt)} · checked {rec.checked} · drifted {rec.drifted} · re-queued {rec.requeued}
            {Array.isArray(rec.driftSamples) && rec.driftSamples.length > 0 && (
              <div className="mt-2 space-y-1">
                {rec.driftSamples.slice(0, 8).map((d, i) => (
                  <div key={i} className="font-mono text-[10px] text-slate-500 break-all">
                    {d.wallet}: db {fmtUsd(d.dbCents)} vs chain {fmtUsd(d.chainCents)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}