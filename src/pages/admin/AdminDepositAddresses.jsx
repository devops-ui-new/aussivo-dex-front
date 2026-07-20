import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import toast from "react-hot-toast";
import { API } from "../../config/api";

const hdr = () => ({
  Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
  "Content-Type": "application/json",
});



const money = (n, dp = 2) => Number(n || 0).toLocaleString(undefined, {
  minimumFractionDigits: dp, maximumFractionDigits: dp,
});

const shortAddr = (a) => (a && a.length > 16 ? `${a.slice(0, 10)}…${a.slice(-6)}` : a || "—");

const ago = (d) => {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

function Stat({ label, value, tone = "slate" }) {
  const tones = {
    slate: "text-slate-100", amber: "text-amber-300",
    red: "text-red-300", green: "text-emerald-300",
  };
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-center">
      <div className={`text-2xl font-bold ${tones[tone]}`}>{value}</div>
      <div className="text-[11px] text-slate-400 mt-1">{label}</div>
    </div>
  );
}

/** Manual recovery — deliberately behind a typed confirmation. */
function RecoverModal({ addr, onClose, onDone }) {
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (confirm !== "RECOVER") return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/deposit-addresses/${addr._id}/recover`, {
        method: "POST",
        headers: hdr(),
        body: JSON.stringify({
          destination: destination.trim(),
          ...(amount.trim() ? { amount: Number(amount) } : {}),
        }),
      });
      const d = await res.json();
      if (d.status === 200) {
        toast.success(`Recovered ${d.data.amount} — tx ${String(d.data.txHash).slice(0, 12)}…`);
        onDone();
        onClose();
      } else {
        toast.error(d.message || "Recovery failed");
      }
    } catch {
      toast.error("Recovery failed");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-slate-900 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-red-300">Manual fund recovery</h3>
        <p className="mt-2 text-sm text-slate-400">
          Moves funds off <span className="font-mono text-slate-200">{shortAddr(addr.address)}</span> to
          any address you specify. This bypasses the credited-only safety rule and is not
          reflected in user balances. Use it only to rescue funds the scanner never booked.
        </p>

        <label className="mt-4 block text-xs text-slate-400">Destination address</label>
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder={addr.network === "trc20" ? "T…" : "0x…"}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-slate-100"
        />

        <label className="mt-3 block text-xs text-slate-400">Amount (blank = entire balance)</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 250.5"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        />

        <label className="mt-3 block text-xs text-slate-400">
          Type <span className="font-mono text-red-300">RECOVER</span> to confirm
        </label>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-slate-100"
        />

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-600 py-2.5 text-sm text-slate-300">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || confirm !== "RECOVER" || !destination.trim()}
            className="flex-1 rounded-lg bg-red-500/20 border border-red-500/40 py-2.5 text-sm font-bold text-red-200 disabled:opacity-40"
          >
            {busy ? "Sending…" : "Recover funds"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDepositAddresses() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [copied, setCopied] = useState(null);
  const [recoverAddr, setRecoverAddr] = useState(null);

  const load = useCallback(() => {
    const q = new URLSearchParams({ page, limit: 25, ...(search ? { search } : {}) });
    fetch(`${API}/api/admin/deposit-addresses?${q}`, { headers: hdr() })
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .catch(() => {});
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (id, action) => {
    setBusyId(id + action);
    try {
      const res = await fetch(`${API}/api/admin/deposit-addresses/${id}/${action}`, {
        method: "POST", headers: hdr(), body: JSON.stringify({}),
      });
      const d = await res.json();
      d.status === 200 ? toast.success(d.message) : toast.error(d.message || "Failed");
      load();
    } catch {
      toast.error("Failed");
    }
    setBusyId(null);
  };

  /**
   * Copy the FULL address, not the truncated display value — the whole point of the
   * button. The tick replaces the icon briefly so the action is visibly acknowledged
   * even if the toast is missed.
   */
  const copyAddress = async (addr) => {
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      toast.success("Address copied");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Could not copy — select the address manually");
    }
  };

  const h = data?.health || {};
  const custody = data?.custody;

  return (
    <AdminLayout title="Deposit Addresses">
      {/* Custody banner — proves keys are recoverable */}
      {custody && (
        <div className={`mb-5 rounded-xl border p-4 ${custody.hdEnabled ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
          <div className="text-sm font-semibold text-slate-100">
            Key custody: {custody.hdEnabled ? "HD (derived from master mnemonic)" : "Encrypted at rest"}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {custody.hdEnabled
              ? "No key material is stored in the database. Every key is re-derivable from the mnemonic, so funds are always recoverable."
              : "Keys are stored as AES-256-GCM ciphertext. Consider setting DEPOSIT_HD_MNEMONIC so no key material is stored at all."}
            {custody.backupCiphertext && " Encrypted backup copies are also being stored."}
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Addresses" value={data?.total ?? "—"} />
        <Stat label="Credits pending" value={h.creditsPending ?? "—"} tone={h.creditsPending ? "amber" : "slate"} />
        <Stat label="Credits failed" value={h.creditsFailed ?? "—"} tone={h.creditsFailed ? "red" : "slate"} />
        <Stat label="Unexplained balance" value={h.unexplained ?? "—"} tone={h.unexplained ? "red" : "slate"} />
      </div>

      {(h.creditsFailed > 0 || h.unexplained > 0) && (
        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
          {h.creditsFailed > 0 && <div>⚠ {h.creditsFailed} credit(s) could not be booked. Funds are safe on-chain — investigate and rescan.</div>}
          {h.unexplained > 0 && <div>⚠ {h.unexplained} address(es) hold more than has been credited. The scanner may be behind.</div>}
        </div>
      )}

      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search by address, name or email…"
        className="mb-4 w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
      />

      <div className="overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-900/50">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700/50 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Address</th>
              <th className="p-3 text-left">Chain</th>
              <th className="p-3 text-right">Credited</th>
              <th className="p-3 text-right">Swept</th>
              <th className="p-3 text-right">Awaiting</th>
              <th className="p-3 text-center">Key</th>
              <th className="p-3 text-left">Last sweep</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.addresses || []).map((a) => (
              <tr key={a._id} className={`border-b border-slate-800/60 ${a.unexplainedBalanceSince ? "bg-red-500/[0.04]" : ""}`}>
                <td className="p-3">
                  <div className="text-slate-200">{a.user?.name || "—"}</div>
                  <div className="text-[11px] text-slate-500">{a.user?.email}</div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-300" title={a.address}>
                      {shortAddr(a.address)}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyAddress(a.address)}
                      title="Copy full address"
                      aria-label={`Copy address ${a.address}`}
                      className="shrink-0 rounded p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-brand"
                    >
                      {copied === a.address ? (
                        <svg className="h-3.5 w-3.5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="11" height="11" rx="2" />
                          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                        </svg>
                      )}
                    </button>
                  </div>
                </td>
                <td className="p-3">
                  <span className={`rounded px-2 py-0.5 text-[11px] ${a.network === "trc20" ? "bg-red-500/15 text-red-300" : "bg-yellow-500/15 text-yellow-300"}`}>
                    {a.network === "trc20" ? "TRC-20" : "BEP-20"}
                  </span>
                </td>
                <td className="p-3 text-right text-slate-200">${money(a.creditedTotal)}</td>
                <td className="p-3 text-right text-slate-400">${money(a.sweptTotal)}</td>
                <td className={`p-3 text-right ${a.awaitingSweep > 0 ? "text-amber-300" : "text-slate-500"}`}>
                  ${money(a.awaitingSweep)}
                </td>
                <td className="p-3 text-center">
                  <span className={`text-[11px] ${a.recoverable ? "text-emerald-300" : "text-red-300"}`}>
                    {a.recoverable ? (a.keySource === "hd" ? "HD ✓" : "Enc ✓") : "LOST"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="text-xs text-slate-400">{ago(a.lastSweepAt)}</div>
                  {a.lastSweepError && (
                    <div className="text-[11px] text-red-300" title={a.lastSweepError}>
                      {a.lastSweepError.slice(0, 40)}
                    </div>
                  )}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => act(a._id, "sweep")}
                    disabled={busyId === a._id + "sweep"}
                    className="mr-1 rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                  >
                    Sweep
                  </button>
                  <button
                    onClick={() => act(a._id, "rescan")}
                    disabled={busyId === a._id + "rescan"}
                    className="mr-1 rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                  >
                    Rescan
                  </button>
                  <button
                    onClick={() => setRecoverAddr(a)}
                    className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    Recover
                  </button>
                </td>
              </tr>
            ))}
            {data && (data.addresses || []).length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-sm text-slate-500">
                  No deposit addresses yet. They are created the first time a user opens a deposit QR.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > 25 && (
        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40">
            Previous
          </button>
          <span className="text-sm text-slate-400">Page {page} of {Math.ceil(data.total / 25)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(data.total / 25)}
            className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40">
            Next
          </button>
        </div>
      )}

      {recoverAddr && (
        <RecoverModal addr={recoverAddr} onClose={() => setRecoverAddr(null)} onDone={load} />
      )}
    </AdminLayout>
  );
}