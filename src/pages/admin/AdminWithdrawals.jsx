import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import toast from "react-hot-toast";

import { API } from "../../config/api";
const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem("admin_token")}`, "Content-Type": "application/json" });

// Withdrawal "source" → the kind of money leaving. We surface these as tabs.
const SOURCE_TABS = [
  { key: "", label: "All" },
  { key: "deposit", label: "Principal" },   // redeeming staked principal
  { key: "yield", label: "Yield" },         // withdrawing earned yield
  { key: "referral", label: "Referral" },   // withdrawing referral earnings
];
const SOURCE_LABEL = { deposit: "Principal", yield: "Yield", referral: "Referral" };
const SOURCE_TAG = { deposit: "tag-green", yield: "tag-blue", referral: "tag-yellow" };

export default function AdminWithdrawals() {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("pending");
  const [source, setSource] = useState("");            // "" = all kinds
  const [page, setPage] = useState(1);

  // single-row controls
  const [txHash, setTxHash] = useState(""); const [note, setNote] = useState(""); const [processing, setProcessing] = useState(null);

  // batch controls
  const [selected, setSelected] = useState(() => new Set());
  const [batchNote, setBatchNote] = useState("");
  const [batchProcessing, setBatchProcessing] = useState(false);

  const load = () => {
    const params = { page, limit: 20, status };
    if (source) params.source = source;
    const q = new URLSearchParams(params);
    fetch(`${API}/api/admin/withdrawals?${q}`, { headers: hdr() })
      .then(r => r.json())
      .then(d => setRequests(d.data?.requests || []));
  };
  // Reload whenever the tab/status/page changes, and clear any stale selection.
  useEffect(() => { load(); setSelected(new Set()); /* eslint-disable-next-line */ }, [page, status, source]);

  const pendingIds = useMemo(() => requests.filter(r => r.status === "pending").map(r => r._id), [requests]);
  const allSelected = pendingIds.length > 0 && pendingIds.every(id => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleOne = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(prev => (allSelected ? new Set() : new Set(pendingIds)));

  // ── single approve/reject (keeps the manual tx-hash option) ──
  const process = async (id, action) => {
    setProcessing(id);
    try {
      const res = await fetch(`${API}/api/admin/withdrawals/process`, {
        method: "POST", headers: hdr(),
        body: JSON.stringify({ requestId: id, action, txHash: action === "approve" ? txHash : "", note }),
      });
      const d = await res.json();
      if (d.status === 200) {
        const hash = d.data?.txHash;
        toast.success(action === "approve" && hash ? `Paid on-chain: ${hash.slice(0, 10)}…` : `Withdrawal ${action}d`);
        setTxHash(""); setNote(""); load();
      } else toast.error(d.message);
    } catch { toast.error("Failed"); }
    setProcessing(null);
  };

  // ── batch approve/reject the selected rows ──
  const processBatch = async (action) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const verb = action === "approve" ? "approve & pay out" : "reject";
    if (!window.confirm(`${action === "approve" ? "Approve" : "Reject"} ${ids.length} withdrawal${ids.length === 1 ? "" : "s"}?\n\nThis will ${verb} each selected request.`)) return;

    setBatchProcessing(true);
    const tId = toast.loading(`Processing ${ids.length} request${ids.length === 1 ? "" : "s"}…`);
    try {
      const res = await fetch(`${API}/api/admin/withdrawals/process-batch`, {
        method: "POST", headers: hdr(),
        body: JSON.stringify({ requestIds: ids, action, note: batchNote }),
      });
      const d = await res.json();
      const { succeeded = 0, failed = 0 } = d.data || {};
      if (d.status === 200 && failed === 0) toast.success(`${succeeded} ${action === "approve" ? "approved" : "rejected"}`, { id: tId });
      else if (succeeded > 0) toast.error(`${succeeded} done, ${failed} failed — check the list`, { id: tId });
      else toast.error(d.message || "Batch failed", { id: tId });
      setSelected(new Set()); setBatchNote(""); load();
    } catch { toast.error("Batch failed", { id: tId }); }
    setBatchProcessing(false);
  };

  return (
    <AdminLayout title="Withdrawals">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-display font-bold text-xl">Withdrawal Requests</h2>
        {/* status filter */}
        <div className="flex gap-1">
          {["pending", "completed", "rejected"].map(f => (
            <button key={f} onClick={() => { setStatus(f); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${status === f ? "bg-brand/10 text-brand" : "text-muted"}`}>{f}</button>
          ))}
        </div>
      </div>

      {/* source tabs: Principal vs Yield vs Referral */}
      <div className="flex gap-1 mb-6 border-b border-white/5">
        {SOURCE_TABS.map(t => (
          <button key={t.key} onClick={() => { setSource(t.key); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${source === t.key ? "border-brand text-brand" : "border-transparent text-muted hover:text-slate-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* batch action bar — only meaningful for pending items */}
      {status === "pending" && (
        <div className="glass p-3 mb-4 flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={pendingIds.length === 0}
              className="w-4 h-4 accent-brand" />
            Select all ({pendingIds.length})
          </label>
          <span className="text-xs text-muted">{selected.size} selected</span>
          <input value={batchNote} onChange={e => setBatchNote(e.target.value)} placeholder="Batch note (optional)"
            className="input-field text-xs flex-1 min-w-[180px]" />
          <button onClick={() => processBatch("approve")} disabled={!someSelected || batchProcessing}
            className="bg-brand/10 text-brand border border-brand/20 rounded-lg px-4 py-2 text-xs font-semibold hover:bg-brand/20 disabled:opacity-40 disabled:cursor-not-allowed">
            {batchProcessing ? "Processing…" : `✓ Approve selected${someSelected ? ` (${selected.size})` : ""}`}
          </button>
          <button onClick={() => processBatch("reject")} disabled={!someSelected || batchProcessing}
            className="bg-red-500/10 text-red-400 border border-red-400/20 rounded-lg px-4 py-2 text-xs font-semibold hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
            ✕ Reject selected{someSelected ? ` (${selected.size})` : ""}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {requests.map(r => {
          const selectable = r.status === "pending";
          const checked = selected.has(r._id);
          return (
            <div key={r._id} className={`glass p-5 ${checked ? "ring-1 ring-brand/40" : ""}`}>
              <div className="flex items-start gap-4">
                {/* selection checkbox (pending only) */}
                {selectable && (
                  <input type="checkbox" checked={checked} onChange={() => toggleOne(r._id)}
                    className="w-4 h-4 mt-1 accent-brand shrink-0" />
                )}
                <div className="flex items-start justify-between flex-1">
                  <div>
                    <div className="font-semibold">{r.userId?.name || "Unknown"} <span className="text-xs text-muted ml-2">{r.userId?.email}</span></div>
                    <div className="text-xs text-muted mt-1 font-mono">{r.walletAddress}</div>
                    <div className="flex gap-4 mt-2 text-sm items-center">
                      <span className="font-bold text-lg text-brand">${r.amount} {r.asset}</span>
                      <span className={`tag ${SOURCE_TAG[r.source] || "tag-blue"} text-[10px]`}>{SOURCE_LABEL[r.source] || r.source}</span>
                      {r.early && <span className="tag tag-red text-[10px]">early · fee ${r.fee}</span>}
                      <span className="text-muted text-xs">{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  {r.status === "pending" && (
                    <div className="space-y-2 w-72 shrink-0">
                      <input value={txHash} onChange={e => setTxHash(e.target.value)} placeholder="Tx hash (leave blank for auto-payout)" className="input-field text-xs" />
                      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className="input-field text-xs" />
                      <div className="flex gap-2">
                        <button onClick={() => process(r._id, "approve")} disabled={processing === r._id}
                          className="flex-1 bg-brand/10 text-brand border border-brand/20 rounded-lg py-2 text-xs font-semibold hover:bg-brand/20 disabled:opacity-50">
                          {processing === r._id ? "..." : "✓ Approve"}
                        </button>
                        <button onClick={() => process(r._id, "reject")} disabled={processing === r._id}
                          className="flex-1 bg-red-500/10 text-red-400 border border-red-400/20 rounded-lg py-2 text-xs font-semibold hover:bg-red-500/20 disabled:opacity-50">
                          {processing === r._id ? "..." : "✕ Reject"}
                        </button>
                      </div>
                    </div>
                  )}
                  {r.status !== "pending" && (
                    <div className="text-right space-y-1">
                      <span className={`tag ${r.status === "completed" ? "tag-green" : "tag-red"}`}>{r.status}</span>
                      {r.txHash && (
                        <div className="text-[10px] font-mono text-muted break-all max-w-[260px]">{r.txHash}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {requests.length === 0 && (
          <div className="glass p-10 text-center text-muted">
            No {status} {source ? `${SOURCE_LABEL[source].toLowerCase()} ` : ""}withdrawal requests
          </div>
        )}
      </div>
    </AdminLayout>
  );
}