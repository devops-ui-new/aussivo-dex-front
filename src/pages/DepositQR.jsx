import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";

import { API } from "../config/api";
import { useWeb3 } from "../context/Web3Context";
import { transferEphemeralFromInjected } from "../utils/transferEphemeralFromInjected";
import { DEPOSIT_STAY_WARNING, DEPOSIT_SINGLE_TX_HINT } from "../constants/depositModalCopy";

function formatRemaining(ms) {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function DepositQR() {
  const { vaultId } = useParams();
  const { connectInjectedWallet, walletType, token } = useWeb3();
  const [vault, setVault] = useState(null);
  const [amount, setAmount] = useState("");
  const [depositModal, setDepositModal] = useState(null);
  const [depositCancelConfirm, setDepositCancelConfirm] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payingInjected, setPayingInjected] = useState(false);
  const [expiresLeftMs, setExpiresLeftMs] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/user/vault/${vaultId}`).then(r => r.json()).then(d => setVault(d.data)).catch(() => {});
  }, [vaultId, API]);

  useEffect(() => {
    if (!depositModal?.qr?.expiresAt) {
      setExpiresLeftMs(null);
      return;
    }
    const end = new Date(depositModal.qr.expiresAt).getTime();
    const tick = () => setExpiresLeftMs(Math.max(0, end - Date.now()));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [depositModal?.qr?.expiresAt]);

  useEffect(() => {
    setDepositCancelConfirm(false);
  }, [depositModal?.qr?.pendingDepositId]);

  const dismissCancelConfirm = useCallback(() => setDepositCancelConfirm(false), []);

  const beginCancelDeposit = useCallback(() => {
    if (!depositModal?.qr?.pendingDepositId) {
      setDepositModal(null);
      return;
    }
    setDepositCancelConfirm(true);
  }, [depositModal]);

  const executeCancelDeposit = useCallback(async () => {
    const pendingDepositId = depositModal?.qr?.pendingDepositId;
    if (!pendingDepositId) {
      setDepositCancelConfirm(false);
      setDepositModal(null);
      return;
    }
    setCancelSubmitting(true);
    try {
      const authToken = localStorage.getItem("aussivo_token");
      const res = await fetch(`${API}/api/user/deposit/pending/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ pendingDepositId }),
      });
      const data = await res.json();
      if (data.status === 200) {
        toast.success(data.message || "Monitoring stopped and deposit intent removed.");
        setDepositCancelConfirm(false);
        setDepositModal(null);
      } else {
        toast.error(data.message || "Could not cancel");
      }
    } catch {
      toast.error("Could not cancel — check your connection.");
    } finally {
      setCancelSubmitting(false);
    }
  }, [depositModal, API]);

  useEffect(() => {
    if (!depositModal) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (depositCancelConfirm) dismissCancelConfirm();
      else beginCancelDeposit();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [depositModal, depositCancelConfirm, beginCancelDeposit, dismissCancelConfirm]);

  useEffect(() => {
    if (!depositModal) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [depositModal]);

  const depositHistoryGuardRef = useRef(null);
  useEffect(() => {
    const pendingId = depositModal?.qr?.pendingDepositId;
    if (!pendingId) {
      const prev = depositHistoryGuardRef.current;
      depositHistoryGuardRef.current = null;
      if (prev && window.history.state?.__aussivoDepositGuard === prev) {
        window.history.back();
      }
      return undefined;
    }

    const onPopState = () => {
      if (!depositHistoryGuardRef.current) return;
      window.history.pushState(
        { __aussivoDepositGuard: depositHistoryGuardRef.current },
        "",
        window.location.href
      );
      toast(DEPOSIT_STAY_WARNING, { duration: 7000 });
      beginCancelDeposit();
    };

    if (depositHistoryGuardRef.current !== pendingId) {
      depositHistoryGuardRef.current = pendingId;
      window.history.pushState({ __aussivoDepositGuard: pendingId }, "", window.location.href);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [depositModal?.qr?.pendingDepositId, beginCancelDeposit]);

  useEffect(() => {
    const pendingId = depositModal?.qr?.pendingDepositId;
    if (!pendingId || !token) return undefined;

    let cancelled = false;
    const tick = async () => {
      try {
        const authToken = localStorage.getItem("aussivo_token");
        const res = await fetch(`${API}/api/user/deposit/pending/${pendingId}/status`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.status === 404) {
          toast.error("This deposit session is no longer active.");
          setDepositModal(null);
          return;
        }
        if (data.status === 200 && data.data?.paymentReceived) {
          const settled = data.data.fullySettled;
          toast.success(
            settled
              ? "Transaction complete. Your payment is confirmed and settled."
              : "Payment received — your vault balance is updating now."
          );
          try {
            window.dispatchEvent(new CustomEvent("aussivo-deposit-complete", { detail: { pendingId } }));
          } catch (_) { /* ignore */ }
          setDepositModal(null);
          return;
        }
        if (data.status === 200 && data.data?.status === "expired") {
          toast.error("This deposit address has expired. Start again if you still want to deposit.");
          setDepositModal(null);
        }
      } catch {
        /* ignore transient network errors */
      }
    };

    tick();
    const iv = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [depositModal?.qr?.pendingDepositId, token, API]);

  const generateQR = async () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error("Enter an amount"); return; }
    setLoading(true);
    try {
      const authToken = localStorage.getItem("aussivo_token");
      const res = await fetch(`${API}/api/user/deposit/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ vaultId, amount: parseFloat(amount) }),
      });
      const data = await res.json();
      if (data.status === 200) setDepositModal({ qr: data.data });
      else toast.error(data.message);
    } catch { toast.error("Failed to generate deposit address"); }
    setLoading(false);
  };

  const handlePayFromInjectedWallet = async () => {
    const qr = depositModal?.qr;
    if (!qr) return;
    if (expiresLeftMs === 0) {
      toast.error("This deposit address has expired.");
      return;
    }
    setPayingInjected(true);
    try {
      toast.loading("Confirm transfer in your wallet…", { id: "pay-inj" });
      await transferEphemeralFromInjected(qr, { walletType, connectInjectedWallet });
      toast.success("Transfer confirmed. Your vault balance updates shortly.", { id: "pay-inj" });
    } catch (err) {
      const msg = err?.shortMessage || err?.reason || err?.message || "Transfer failed";
      toast.error(msg, { id: "pay-inj", duration: 6000 });
    }
    setPayingInjected(false);
  };

  if (!vault) return <div className="max-w-xl mx-auto px-6 py-20"><div className="glass p-10 h-[300px] shimmer rounded-2xl" /></div>;

  const modalQr = depositModal?.qr;

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <Link to={`/pool/${vaultId}`} className="text-sm text-muted hover:text-slate-300 mb-6 inline-block">← Back to Vault</Link>
      <div className="glass p-8">
        <div className="text-center mb-6">
          <h1 className="font-display font-bold text-2xl mb-2">Deposit {vault.asset}</h1>
          <p className="text-muted text-sm">into {vault.name}</p>
        </div>

        {!depositModal ? (
          <>
            <div className="mb-6">
              <label className="text-sm text-muted mb-2 block">Deposit Amount ({vault.asset})</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder={`Min: $${vault.minDeposit}`}
                className="input-field text-lg font-display font-semibold" />
              <div className="flex justify-between text-xs text-muted mt-2">
                <span>Min: ${vault.minDeposit}</span>
                <span>Max: ${vault.maxDeposit}</span>
              </div>
            </div>
            {amount && parseFloat(amount) > 0 && (
              <div className="bg-surface-2/50 rounded-xl p-4 mb-6 border border-surface-4/30">
                <div className="flex justify-between text-sm mb-1"><span className="text-muted">Monthly Yield</span>
                  <span className="text-brand font-semibold">+${(parseFloat(amount) * (vault.tiers?.[0]?.apyPercent || 1) / 100).toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted">APY</span>
                  <span className="font-semibold">{vault.tiers?.[0]?.apyPercent || "—"}% /mo</span></div>
              </div>
            )}
            <button onClick={generateQR} disabled={loading} className="btn-primary w-full py-4 text-base disabled:opacity-50">
              {loading ? "Generating..." : "Get deposit address"}
            </button>
          </>
        ) : (
          <div className="rounded-xl border border-surface-4/50 bg-surface-2/40 p-4 text-left">
            <p className="font-display text-sm font-semibold text-slate-200">Deposit in progress</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">{DEPOSIT_STAY_WARNING}</p>
          </div>
        )}
      </div>

      {modalQr &&
        typeof document !== "undefined" &&
        createPortal(
        <>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-qr-modal-heading"
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md px-4 py-8 sm:px-6"
            onClick={beginCancelDeposit}
          >
            <div
              className="glass relative w-full max-w-md max-h-[min(92vh,720px)] overflow-y-auto rounded-2xl shadow-2xl ring-1 ring-white/[0.06]"
              onClick={e => e.stopPropagation()}
            >
              <div className="border-b border-surface-4/50 px-5 pt-5 pb-4 text-center">
                <h2 id="deposit-qr-modal-heading" className="font-display text-lg font-semibold tracking-tight text-slate-100">
                  Complete your deposit
                </h2>
                <p className="mt-1 text-xs text-muted">{modalQr.network}</p>
              </div>

              <div className="px-5 pt-4">
                <div className="flex gap-3 rounded-xl border border-brand/20 bg-brand/[0.06] px-3.5 py-3">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-5M12 8h.01" strokeLinecap="round" />
                  </svg>
                  <p className="text-left text-sm leading-relaxed text-slate-300">{DEPOSIT_STAY_WARNING}</p>
                </div>
              </div>

              <div className="space-y-4 px-5 pb-5 pt-5">
                <div className="flex justify-center">
                  <img
                    src={modalQr.qrCode}
                    alt="Deposit QR"
                    className="h-48 w-48 rounded-xl border border-surface-4/60 bg-white p-2 shadow-inner sm:h-52 sm:w-52"
                  />
                </div>

                <div className="rounded-xl border border-surface-4/50 bg-surface-2/40 p-4 text-center">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted">Send exactly</div>
                  <div className="mt-1 font-display text-2xl font-bold text-brand">{modalQr.amount} {modalQr.asset}</div>
                  <p className="mt-3 text-left text-xs leading-relaxed text-amber-200/90">{DEPOSIT_SINGLE_TX_HINT}</p>
                </div>

                {expiresLeftMs != null && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-center text-sm font-semibold ${
                      expiresLeftMs === 0
                        ? "border-red-500/35 bg-red-500/[0.08] text-red-300"
                        : "border-surface-4/50 bg-surface-2/40 text-slate-300"
                    }`}
                  >
                    {expiresLeftMs === 0 ? (
                      "This address has expired. Close and start again."
                    ) : (
                      <>
                        <span className="text-muted">Time remaining </span>
                        <span className="font-mono text-brand">{formatRemaining(expiresLeftMs)}</span>
                      </>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-surface-4/50 bg-surface-2/40 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted">One-time address</div>
                  <div className="mt-2 break-all font-mono text-sm text-slate-300">{modalQr.depositAddress}</div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(modalQr.depositAddress);
                      toast.success("Copied!");
                    }}
                    className="mt-3 text-xs font-semibold text-brand hover:text-brand-light"
                  >
                    Copy address
                  </button>
                </div>

                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-surface-4/50" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">or pay from wallet</span>
                  <div className="h-px flex-1 bg-surface-4/50" />
                </div>

                <button
                  type="button"
                  onClick={handlePayFromInjectedWallet}
                  disabled={payingInjected || expiresLeftMs === 0 || !window.ethereum}
                  className="btn-primary w-full rounded-xl py-3.5 text-base font-display font-bold disabled:opacity-50"
                >
                  {payingInjected ? "Waiting for wallet…" : `Pay ${modalQr.amount} ${modalQr.asset}`}
                </button>

                <button
                  type="button"
                  onClick={beginCancelDeposit}
                  className="w-full rounded-xl border border-surface-4/60 py-3 text-sm font-semibold text-slate-400 transition-colors hover:border-slate-500 hover:bg-surface-2/50 hover:text-slate-200"
                >
                  Cancel deposit
                </button>
              </div>
            </div>
          </div>

          {depositCancelConfirm && (
            <div
              className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
              role="presentation"
              onClick={dismissCancelConfirm}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="deposit-qr-cancel-title"
                className="glass w-full max-w-sm rounded-2xl p-5 shadow-2xl ring-1 ring-white/[0.06]"
                onClick={e => e.stopPropagation()}
              >
                <h3 id="deposit-qr-cancel-title" className="font-display text-base font-semibold text-slate-100">
                  Cancel this deposit?
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{DEPOSIT_STAY_WARNING}</p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={dismissCancelConfirm}
                    className="flex-1 rounded-xl border border-surface-4/60 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-surface-2/50"
                  >
                    Keep deposit
                  </button>
                  <button
                    type="button"
                    disabled={cancelSubmitting}
                    onClick={executeCancelDeposit}
                    className="flex-1 rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                  >
                    {cancelSubmitting ? "…" : "Yes, cancel"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </div>
  );
}
