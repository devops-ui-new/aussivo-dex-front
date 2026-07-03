import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useWeb3 } from "../context/Web3Context";

const DEBRIDGE_REF = import.meta.env.VITE_DEBRIDGE_REF || "";
// BSC mainnet USDC — default destination for cross-chain swaps.
const USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const WIDGET_SCRIPT = "https://app.debridge.finance/assets/scripts/widget.js";
const HOLDER_ID = "debridge-widget-holder";

let _scriptPromise = null;
function loadWidgetScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.deBridge) return Promise.resolve();
  if (_scriptPromise) return _scriptPromise;
  _scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = WIDGET_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { _scriptPromise = null; reject(new Error("widget script failed")); };
    document.body.appendChild(s);
  });
  return _scriptPromise;
}

function SwapWidget({ account }) {
  const holderRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | fallback

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadWidgetScript()
      .then(() => {
        if (cancelled || !window.deBridge || !holderRef.current) return;
        holderRef.current.innerHTML = ""; // clear any previous render (e.g. on wallet change)
        window.deBridge.widget({
          v: "1",
          element: HOLDER_ID,
          title: "",
          width: "100%",
          height: "800",
          inputChain: 1,       // Ethereum
          outputChain: 56,     // BNB Smart Chain
          inputCurrency: "",
          outputCurrency: USDC_BSC,
          address: account || "",
          showSwapTransfer: true,
          lang: "en",
          mode: "deswap",
          theme: "dark",
          r: DEBRIDGE_REF || null,
        });
        if (!cancelled) setStatus("ready");
      })
      .catch(() => { if (!cancelled) setStatus("fallback"); });
    return () => { cancelled = true; };
  }, [account]);

  // Fallback: the deswap page in a properly-sized, scrollable iframe (NOT cropped).
  if (status === "fallback") {
    const params = new URLSearchParams({
      inputChain: "1", outputChain: "56",
      inputCurrency: "0x0000000000000000000000000000000000000000",
      outputCurrency: USDC_BSC, mode: "deswap", lang: "en", theme: "dark",
    });
    if (account) params.set("address", account);
    if (DEBRIDGE_REF) params.set("r", DEBRIDGE_REF);
    return (
      <iframe
        title="deBridge Swap"
        src={`https://app.debridge.finance/?${params.toString()}`}
        className="w-full rounded-2xl border border-surface-3/60 bg-surface-1"
        style={{ height: "min(860px, 84vh)", border: 0, display: "block" }}
        allow="clipboard-read; clipboard-write; ethereum *; payment *"
      />
    );
  }

  return (
    <div className="relative w-full">
      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-muted text-sm">
            <div className="h-6 w-6 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
            Loading swap…
          </div>
        </div>
      )}
      <div id={HOLDER_ID} ref={holderRef} className="w-full min-h-[600px]" />
    </div>
  );
}

export default function Swap() {
  const { account, connectWallet } = useWeb3();
  const [switching, setSwitching] = useState(false);

  const switchWallet = async () => {
    if (!window.ethereum) { toast.error("Install MetaMask or a compatible wallet"); return; }
    setSwitching(true);
    try {
      await window.ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      await connectWallet?.();
      toast.success("Wallet switched. The swap widget will update shortly.");
    } catch (e) {
      if (e?.code !== 4001) toast.error(e?.message || "Wallet switch cancelled");
    }
    setSwitching(false);
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="text-center mb-6">
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-white">Swap</h1>
        <p className="text-muted mt-2 max-w-md mx-auto">
          Swap any token across chains into USDC or USDT, then deposit into a vault.
        </p>
      </div>

      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="text-muted">
          {account ? <>Connected: <span className="font-mono text-slate-200">{account.slice(0, 6)}…{account.slice(-4)}</span></> : "No wallet connected"}
        </span>
        <button
          onClick={switchWallet}
          disabled={switching}
          className="text-brand-dark font-semibold hover:underline disabled:opacity-50"
        >
          {switching ? "Switching…" : account ? "Switch wallet" : "Connect wallet"}
        </button>
      </div>

      {/* Widget card */}
      <div className="relative rounded-3xl border border-surface-3/60 bg-surface-1/70 p-2 sm:p-3 shadow-2xl shadow-black/40">
        <div className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-b from-brand/10 to-transparent opacity-60" />
        <div className="relative">
          <SwapWidget account={account} />
        </div>
      </div>

      <p className="text-center text-[11px] text-muted mt-4">
        Cross-chain swaps are powered by deBridge. Aussivo does not custody funds during the swap.
      </p>
    </div>
  );
}