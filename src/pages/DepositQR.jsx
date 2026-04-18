import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";

import { API } from "../config/api";

export default function DepositQR() {
  const { vaultId } = useParams();
  const [vault, setVault] = useState(null);
  const [amount, setAmount] = useState("");
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/user/vault/${vaultId}`).then(r => r.json()).then(d => setVault(d.data)).catch(() => {});
  }, [vaultId]);

  const generateQR = async () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error("Enter an amount"); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem("aussivo_token");
      const res = await fetch(`${API}/api/user/deposit/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vaultId, amount: parseFloat(amount) }),
      });
      const data = await res.json();
      if (data.status === 200) setQrData(data.data);
      else toast.error(data.message);
    } catch { toast.error("Failed to generate QR"); }
    setLoading(false);
  };

  if (!vault) return <div className="max-w-xl mx-auto px-6 py-20"><div className="glass p-10 h-[300px] shimmer rounded-2xl" /></div>;

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <Link to={`/pool/${vaultId}`} className="text-sm text-muted hover:text-slate-300 mb-6 inline-block">← Back to Vault</Link>
      <div className="glass p-8">
        <div className="text-center mb-6">
          <h1 className="font-display font-bold text-2xl mb-2">Deposit {vault.asset}</h1>
          <p className="text-muted text-sm">into {vault.name}</p>
        </div>

        {!qrData ? (
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
              {loading ? "Generating..." : "Generate Deposit QR Code"}
            </button>
          </>
        ) : (
          <div className="text-center">
            <img src={qrData.qrCode} alt="Deposit QR" className="mx-auto w-64 h-64 rounded-xl border-2 border-brand/20 mb-4" />
            <div className="bg-surface-2/50 rounded-xl p-4 mb-4 border border-brand/10">
              <div className="text-xs text-muted mb-1">Send exactly</div>
              <div className="text-xl font-display font-bold text-brand">{qrData.amount} {qrData.asset}</div>
              <div className="text-xs text-muted mt-1">on {qrData.network}</div>
            </div>
            <div className="bg-surface-2/50 rounded-xl p-4 mb-4 text-left">
              <div className="text-xs text-muted mb-1">To Address</div>
              <div className="text-sm font-mono break-all text-slate-300">{qrData.depositAddress}</div>
              <button onClick={() => { navigator.clipboard.writeText(qrData.depositAddress); toast.success("Copied!"); }}
                className="mt-2 text-xs text-brand hover:underline">Copy Address</button>
            </div>
            <div className="text-left space-y-2 mb-6">
              {qrData.instructions?.map((inst, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted">
                  <span className="text-brand mt-0.5">•</span><span>{inst}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setQrData(null)} className="btn-secondary w-full">Generate New QR</button>
          </div>
        )}
      </div>
    </div>
  );
}
