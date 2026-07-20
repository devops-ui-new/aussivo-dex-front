import { useEffect, useState, useCallback } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import toast from "react-hot-toast";
import { API } from "../../config/api";

const hdr = () => ({
  Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
  "Content-Type": "application/json",
});


/**
 * Deposits settled outside the platform (paid to the user directly), so they are no
 * longer open items and shouldn't appear anywhere in admin.
 *
 * UI-level filter by design: the underlying records are untouched, so this is trivially
 * reversible — remove an address from this list and it reappears everywhere.
 * Add the on-chain address exactly as it appears on the explorer.
 */


/**
 * Alerts suppressed in the UI.
 *  - "purged key": the deposit was settled outside the platform.
 *  - "scanner is behind": expected on a public BSC RPC that will not serve eth_getLogs.
 *    Deposits still credit via the balance fallback, so this is a standing condition
 *    rather than an incident. Scanner lag is still shown as a number under Details.
 * Delete a pattern here to bring the alert back.
 */
const SUPPRESSED_ALERTS = [/purged key/i, /scanner is behind/i];
const isSuppressedAlert = (a) => {
  const text = `${a?.title || ""} ${a?.detail || ""}`;
  return SUPPRESSED_ALERTS.some((re) => re.test(text));
};

const money = (n, dp = 2) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

const shortAddr = (a) => (a && a.length > 20 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a || "—");

/**
 * Design rule for this page: an admin should be able to glance at the top line and
 * look away. Only things that need a human decision are visible by default.
 * Everything diagnostic lives behind "Details".
 */
export default function AdminSweepHealth() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(null);
  const [details, setDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // `silent` is used by the 15s poll so the button doesn't flicker on its own.
  const load = useCallback(async (silent = true) => {
    if (!silent) setRefreshing(true);
    try {
      const r = await fetch(`${API}/api/admin/sweep-status`, { headers: hdr() });
      const res = await r.json();
      if (res?.data) {
        setD(res.data);
        if (!silent) toast.success("Refreshed");
      } else if (!silent) {
        toast.error(res?.message || "Could not refresh");
      }
    } catch {
      if (!silent) toast.error("Could not refresh — check your connection");
    } finally {
      // Keep the spinner visible briefly so a fast response still reads as an action.
      if (!silent) setTimeout(() => setRefreshing(false), 400);
    }
  }, []);

  useEffect(() => {
    // Explicit `true` so the poll can never be mistaken for a user-triggered refresh
    // (setInterval passing an argument would otherwise flip it).
    load(true);
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [load]);

  const force = async (id, kind) => {
    setBusy(id);
    try {
      const url =
        kind === "persistent"
          ? `${API}/api/admin/deposit-addresses/${id}/sweep`
          : `${API}/api/admin/sweep-status/force`;
      const body = kind === "persistent" ? {} : { pendingId: id };
      const res = await fetch(url, { method: "POST", headers: hdr(), body: JSON.stringify(body) });
      const r = await res.json();
      r.status === 200 ? toast.success(r.message) : toast.error(r.message || "Failed");
      load();
    } catch {
      toast.error("Failed");
    }
    setBusy(null);
  };

  if (!d) {
    return (
      <AdminLayout title="Deposit Health">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-800/40" />
      </AdminLayout>
    );
  }

  const visibleAlerts = (d.alerts || []).filter((a) => !isSuppressedAlert(a));
  const criticals = visibleAlerts.filter((a) => a.level === "critical");
  const minor = visibleAlerts.filter((a) => a.level !== "critical");

  // Combined money view — the only numbers that matter at a glance.
  const pb = d.persistent?.bep20 || {};
  const pt = d.persistent?.trc20 || {};
  const credited = (pb.creditedTotal || 0) + (pt.creditedTotal || 0);
  const swept = (pb.sweptTotal || 0) + (pt.sweptTotal || 0);
  const awaiting = (pb.awaitingSweepTotal || 0) + (pt.awaitingSweepTotal || 0);

  const toSweep = [
    ...(pb.blocked || []).map((b) => ({ ...b, kind: "persistent", chain: "BSC" })),
    ...(pt.blocked || []).map((b) => ({ ...b, kind: "persistent", chain: "Tron" })),
    ...(d.legacy?.bep20?.stuck || []).map((s) => ({ ...s, kind: "legacy", chain: "BSC", awaiting: s.amount })),
    ...(d.legacy?.trc20?.stuck || []).map((s) => ({ ...s, kind: "legacy", chain: "Tron", awaiting: s.amount })),
  ];

  const healthy = criticals.length === 0;

  return (
    <AdminLayout title="Deposit Health">
      {/* ── One-line status ── */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${healthy ? "bg-emerald-400" : "bg-amber-400"}`} />
          <span className="text-lg font-semibold text-slate-100">
            {healthy
              ? "Deposits running normally"
              : `${criticals.length} item${criticals.length > 1 ? "s" : ""} need a decision`}
          </span>
        </div>
        <button
          onClick={() => load(false)}
          disabled={refreshing}
          title="Refresh now"
          className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>↻</span>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* ── Money, always visible, three numbers ── */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          ["Credited to users", credited, "text-slate-100"],
          ["In treasury", swept, "text-emerald-300"],
          ["Awaiting sweep", awaiting, awaiting > 0 ? "text-amber-300" : "text-slate-500"],
        ].map(([label, val, tone]) => (
          <div key={label} className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-4 text-center">
            <div className={`text-2xl font-bold ${tone}`}>${money(val)}</div>
            <div className="mt-1 text-[11px] text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Only what needs a decision ── */}
      {criticals.length > 0 && (
        <div className="mb-6 space-y-2">
          {criticals.map((a, i) => (
            <div key={i} className="rounded-xl border border-slate-700/60 bg-slate-800/30 px-4 py-3">
              <div className="text-sm font-medium text-slate-200">{a.title}</div>
              <div className="mt-0.5 text-xs text-slate-500">{a.detail}</div>
              {a.action && <div className="mt-1.5 text-xs text-amber-300/80">{a.action}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── Anything you can act on with one click ── */}
      {toSweep.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Ready to sweep
          </div>
          <div className="space-y-2">
            {toSweep.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm text-slate-200">
                    ${money(s.awaiting)}{" "}
                    <span className="text-xs text-slate-500">
                      · {s.chain} · {s.email || shortAddr(s.address)}
                    </span>
                  </div>
                  {s.blockedReason && <div className="mt-0.5 text-[11px] text-amber-300">{s.blockedReason}</div>}
                </div>
                {s.canForceSweep !== false ? (
                  <button
                    onClick={() => force(s.id, s.kind)}
                    disabled={busy === s.id}
                    className="shrink-0 rounded-lg border border-brand/40 bg-brand/15 px-3 py-1.5 text-xs font-semibold text-brand disabled:opacity-40"
                  >
                    {busy === s.id ? "…" : "Sweep"}
                  </button>
                ) : (
                  <span className="shrink-0 text-xs text-slate-500">Needs key restore</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {healthy && toSweep.length === 0 && (
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 py-8 text-center text-sm text-slate-500">
          Nothing needs attention.
        </div>
      )}

      {/* Per-chain breakdown — the structure from the earlier layout, quiet styling. */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {[
          ["BSC (BEP-20)", pb],
          ["Tron (TRC-20)", pt],
        ].map(([label, p]) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">{label}</span>
              <span className="text-[10px] text-slate-600">{p?.addresses ?? 0} address(es)</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Credited", p?.creditedTotal, "text-slate-200"],
                ["In treasury", p?.sweptTotal, "text-emerald-300"],
                ["Awaiting", p?.awaitingSweepTotal, (p?.awaitingSweepTotal || 0) > 0 ? "text-amber-300" : "text-slate-600"],
              ].map(([l, v, tone]) => (
                <div key={l} className="rounded-lg border border-slate-800 bg-slate-900/40 px-2 py-2.5 text-center">
                  <div className={`text-base font-semibold ${tone}`}>${money(v)}</div>
                  <div className="mt-0.5 text-[10px] text-slate-500">{l}</div>
                </div>
              ))}
            </div>
            {(p?.awaitingSweepTotal || 0) === 0 && (p?.addresses || 0) > 0 && (
              <div className="mt-2.5 text-center text-[11px] text-slate-600">
                Everything credited has reached treasury
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Everything diagnostic, hidden by default ── */}
      <button
        onClick={() => setDetails((v) => !v)}
        className="w-full rounded-xl border border-slate-800 px-4 py-2.5 text-left text-xs text-slate-500 hover:bg-slate-900/40"
      >
        {details ? "Hide details ▲" : "Details ▼"}
        {minor.length > 0 && !details && <span className="ml-2 text-slate-600">· {minor.length} minor</span>}
      </button>

      {details && (
        <div className="mt-3 space-y-4">
          {minor.length > 0 && (
            <div className="space-y-2">
              {minor.map((a, i) => (
                <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-2.5">
                  <div className="text-xs font-medium text-slate-300">{a.title}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{a.detail}</div>
                  {a.action && <div className="mt-1 text-[11px] text-slate-400">{a.action}</div>}
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["BSC gas funder", d.funders?.bep20, "BNB"],
              ["Tron gas funder", d.funders?.trc20, "TRX"],
            ].map(([label, f, unit]) => (
              <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">{label}</span>
                  <span className={`text-[11px] ${f?.ok ? "text-emerald-400" : "text-amber-400"}`}>
                    {f ? (f.ok ? "OK" : "Low") : "—"}
                  </span>
                </div>
                <div className="mt-0.5 text-sm text-slate-200">
                  {f ? `${unit === "BNB" ? f.bnb : f.trx} ${unit}` : "Not configured"}
                </div>
                {f && <div className="mt-0.5 break-all font-mono text-[10px] text-slate-600">{f.address}</div>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              ["Scanner lag", `${d.scanner?.maxLagBlocks ?? 0} blocks`],
              ["Credits queued", d.credits?.pending ?? 0],
              ["Credits failed", d.credits?.failed ?? 0],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-slate-800 bg-slate-900/30 px-3 py-2.5 text-center">
                <div className="text-sm font-semibold text-slate-200">{v}</div>
                <div className="mt-0.5 text-[10px] text-slate-500">{l}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["BSC addresses", d.persistent?.bep20],
              ["Tron addresses", d.persistent?.trc20],
            ].map(([l, p]) => (
              <div key={l} className="rounded-lg border border-slate-800 bg-slate-900/30 p-3 text-[11px] text-slate-500">
                <div className="mb-1 text-slate-300">{l}</div>
                {p?.addresses ?? 0} active · ${money(p?.creditedTotal)} credited · ${money(p?.sweptTotal)} swept
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3 text-[11px] text-slate-500">
            <div className="mb-1 text-slate-300">Legacy one-time addresses</div>
            BSC: {d.legacy?.bep20?.openSessions ?? 0} open · {d.legacy?.bep20?.awaitingSweep ?? 0} awaiting sweep
            <br />
            Tron: {d.legacy?.trc20?.openSessions ?? 0} open · {d.legacy?.trc20?.awaitingSweep ?? 0} awaiting sweep
            <div className="mt-1 text-slate-600">Retire the old flow once both reach 0.</div>
          </div>

          <div className="text-center text-[10px] text-slate-700">
            Updated {new Date(d.generatedAt).toLocaleTimeString()}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}