import { useEffect, useState } from "react";
import { useWeb3 } from "../context/Web3Context";
import toast from "react-hot-toast";

/**
 * Shown ONCE per session to a signed-in user who has an active investment but no wallet on file
 * (needsWalletForAttestation from /me). Linking their wallet lets the backend attest their
 * position on-chain so they can verify it themselves. Fully dismissible — never blocks the app.
 */
export default function WalletPromptModal() {
  const { user, token, account, connectWallet, linkWallet } = useWeb3();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || dismissed) { setOpen(false); return; }
    // Re-check whenever the user object refreshes; auto-closes once a wallet is linked.
    setOpen(!!user?.needsWalletForAttestation);
  }, [user, token, dismissed]);

  if (!open) return null;

  const submit = async (addr) => {
    if (!addr) return;
    setBusy(true);
    try {
      const d = await linkWallet(addr);
      if (d?.status === 200) {
        toast.success("Wallet linked — syncing your position on-chain");
        setOpen(false); // user refresh clears needsWalletForAttestation
      } else {
        toast.error(d?.message || "Could not link this wallet");
      }
    } catch {
      toast.error("Something went wrong linking your wallet");
    }
    setBusy(false);
  };

  const connectAndLink = async () => {
    setBusy(true);
    try {
      const addr = account || (await connectWallet());
      if (!addr) { setBusy(false); return; } // user rejected — connectWallet toasts its own errors
      await submit(addr);
    } catch {
      toast.error("Wallet connection failed");
      setBusy(false);
    }
  };

  const close = () => { setDismissed(true); setOpen(false); };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-md px-4" onClick={close}>
      <div className="glass relative w-full max-w-md rounded-2xl p-7 ring-1 ring-white/[0.06]" onClick={(e) => e.stopPropagation()}>
        <button onClick={close} aria-label="Dismiss" className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 text-lg leading-none">×</button>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/15 text-brand mb-4">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h18v12H3z" strokeLinejoin="round"/><path d="M16 12h3M3 7l3-3h12l3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>

        <h3 className="font-display text-xl font-bold text-white">Link your wallet</h3>
        <p className="mt-2 text-sm text-slate-400">
          You have an active investment but no wallet on file. Link one and your deposited principal is
          attested to Aussivo's public registry contract — so you can verify your position on-chain
          yourself, any time. It takes a moment.
        </p>

        <div className="mt-5 space-y-2.5">
          <button onClick={connectAndLink} disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-brand-dark to-brand py-3.5 font-display font-bold text-white hover:shadow-lg hover:shadow-brand/20 disabled:opacity-50">
            {busy ? "Linking…" : account ? `Link ${account.slice(0, 6)}…${account.slice(-4)}` : "Connect & link wallet"}
          </button>

          <div className="flex items-center gap-2 py-1">
            <div className="h-px flex-1 bg-surface-4/50" />
            <span className="text-[11px] text-slate-500">or paste an address</span>
            <div className="h-px flex-1 bg-surface-4/50" />
          </div>

          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value.trim())}
              placeholder="0x…"
              className="flex-1 rounded-xl border border-surface-4/60 bg-[#0d1324] px-3 py-2.5 text-sm font-mono text-slate-200 placeholder-slate-600 focus:border-brand/40 focus:outline-none"
            />
            <button onClick={() => submit(manual)} disabled={busy || manual.length < 10}
              className="rounded-xl border border-surface-4/60 px-4 text-sm font-semibold text-slate-200 hover:border-brand/40 hover:bg-brand/[0.06] disabled:opacity-40">
              Link
            </button>
          </div>
        </div>

        <button onClick={close} disabled={busy} className="mt-4 w-full text-sm font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50">
          Maybe later
        </button>
      </div>
    </div>
  );
}