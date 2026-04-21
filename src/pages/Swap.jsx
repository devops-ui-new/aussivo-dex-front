import { useState } from "react";
import toast from "react-hot-toast";
import { useWeb3 } from "../context/Web3Context";

const ONRAMPER_API_KEY = import.meta.env.VITE_ONRAMPER_API_KEY;
const DEBRIDGE_REF = import.meta.env.VITE_DEBRIDGE_REF || "";

// BSC mainnet USDC — default destination for cross-chain swaps.
const USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

function DebridgeWidget({ account }) {
  // Iframe embed of app.debridge.finance. Wallet connection happens on
  // deBridge's origin (they handle MetaMask / WalletConnect / Coinbase).
  const params = new URLSearchParams({
    inputChain: "1",
    outputChain: "56",
    inputCurrency: "0x0000000000000000000000000000000000000000",
    outputCurrency: USDC_BSC,
    mode: "deswap",
    lang: "en",
    theme: "dark",
  });
  if (account) params.set("address", account);
  if (DEBRIDGE_REF) params.set("r", DEBRIDGE_REF);
  const widgetUrl = `https://app.debridge.finance/?${params.toString()}`;

  // Cross-origin iframe — we can't remove the deBridge footer via CSS. Crop
  // it visually by sizing the iframe larger than the visible viewport.
  const VISIBLE_HEIGHT = 780;
  const IFRAME_HEIGHT = 1800;
  return (
    <div
      className="w-full rounded-2xl border border-surface-3/60"
      style={{ position: "relative", height: VISIBLE_HEIGHT, overflow: "hidden" }}
    >
      <iframe
        title="deBridge Swap"
        src={widgetUrl}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: IFRAME_HEIGHT, border: 0, display: "block" }}
        scrolling="no"
        allow="clipboard-read; clipboard-write; ethereum *; payment *"
      />
    </div>
  );
}

function OnramperWidget({ account }) {
  if (!ONRAMPER_API_KEY) {
    return <div className="glass p-6 text-sm text-amber-400">Onramper API key not configured. Set VITE_ONRAMPER_API_KEY.</div>;
  }
  const params = new URLSearchParams({
    apiKey: ONRAMPER_API_KEY,
    themeName: "dark",
  });
  if (account) {
    params.set("networkWallets", JSON.stringify([{ networkCode: "bsc", walletAddress: account }]));
  }
  return (
    <iframe
      title="Onramper"
      src={`https://buy.onramper.com?${params.toString()}`}
      className="w-full rounded-2xl border border-surface-3/60"
      style={{ minHeight: 700 }}
      allow="accelerometer; autoplay; camera; gyroscope; payment; microphone; clipboard-read; clipboard-write"
    />
  );
}

export default function Swap() {
  const { account, connectWallet } = useWeb3();
  const [tab, setTab] = useState("swap");
  const [switching, setSwitching] = useState(false);

  const switchWallet = async () => {
    if (!window.ethereum) { toast.error("Install MetaMask or a compatible wallet"); return; }
    setSwitching(true);
    try {
      // Forces MetaMask's account picker regardless of prior grants. The
      // resulting `accountsChanged` event propagates to every site MetaMask
      // is connected to — including the deBridge iframe on app.debridge.finance.
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      await connectWallet?.();
      toast.success("Wallet switched. The swap widget will update shortly.");
    } catch (e) {
      if (e?.code !== 4001) toast.error(e?.message || "Wallet switch cancelled");
    }
    setSwitching(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display font-bold text-3xl text-white">Swap & Buy</h1>
        <div className="flex items-center gap-3 text-xs">
          {account && (
            <span className="text-muted">
              <span className="font-mono text-white">{account.slice(0, 6)}…{account.slice(-4)}</span>
            </span>
          )}
          <button
            onClick={switchWallet}
            disabled={switching}
            className="text-brand-dark font-semibold hover:underline disabled:opacity-50"
          >
            {switching ? "Switching…" : account ? "Switch wallet" : "Connect wallet"}
          </button>
        </div>
      </div>
      <p className="text-muted mb-6 max-w-xl">
        Swap any token across chains, or buy stablecoins with card / bank transfer.
      </p>

      <div className="flex bg-surface-2/40 rounded-xl p-1 mb-6 w-fit">
        {[
          { key: "swap", label: "Cross-chain Swap" },
          { key: "buy", label: "Buy with Card" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key ? "bg-brand text-white shadow" : "text-muted hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "swap" ? <DebridgeWidget account={account} /> : <OnramperWidget account={account} />}
    </div>
  );
}
