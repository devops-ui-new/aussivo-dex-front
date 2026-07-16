import { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { CHAIN } from "../config/chain";

/**
 * OnChainTicker — a small "we're really on-chain" status pill: live block height + gas price,
 * read from a public BSC RPC every ~12s. Read-only, dependency-free beyond ethers (already used
 * app-wide). Fails silent (renders nothing) if the RPC is unreachable, so it never blocks the UI.
 */
export default function OnChainTicker({ className = "" }) {
  const [block, setBlock] = useState(null);
  const [gwei, setGwei] = useState(null);
  const [pulse, setPulse] = useState(false);
  const providerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let provider;
    try { provider = new ethers.JsonRpcProvider(CHAIN.rpc); } catch { return undefined; }
    providerRef.current = provider;

    const tick = async () => {
      try {
        const [bn, fee] = await Promise.all([provider.getBlockNumber(), provider.getFeeData()]);
        if (cancelled) return;
        setBlock(bn);
        if (fee?.gasPrice != null) setGwei(Math.max(0.01, Number(fee.gasPrice) / 1e9));
        setPulse(true); setTimeout(() => !cancelled && setPulse(false), 700);
      } catch { /* keep last known values */ }
    };

    tick();
    const iv = setInterval(tick, 12000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (block == null) return null;

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-emerald-400 transition-opacity ${pulse ? "opacity-100" : "opacity-50"}`} />
      <span className="text-slate-400">{CHAIN.name}</span>
      <span className="font-mono text-slate-200">#{block.toLocaleString()}</span>
      {gwei != null && <><span className="text-slate-600">·</span><span className="font-mono text-slate-300">{gwei.toFixed(gwei < 10 ? 2 : 1)} gwei</span></>}
    </div>
  );
}