import { useState } from "react";
import toast from "react-hot-toast";
import { useWeb3 } from "../context/Web3Context";

const DEBRIDGE_REF = import.meta.env.VITE_DEBRIDGE_REF || "";

// BSC mainnet USDC — default destination for cross-chain swaps.
const USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

function DebridgeWidget({ account }) {
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

  // Cross-origin iframe — crop the deBridge footer by sizing the iframe
  // larger than the visible viewport.
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

export default function Swap() {
  const { account, connectWallet } = useWeb3();
  const [switching, setSwitching] = useState(false);

  const switchWallet = async () => {
    if (!window.ethereum) { toast.error("Install MetaMask or a compatible wallet"); return; }
    setSwitching(true);
    try {
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
        <h1 className="font-display font-bold text-3xl text-white">Swap</h1>
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
        Swap any token across chains into USDC or USDT.
      </p>

      <DebridgeWidget account={account} />
    </div>
  );
}
