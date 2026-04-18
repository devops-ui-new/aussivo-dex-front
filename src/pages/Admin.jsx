import { useState } from "react";
import { useWeb3 } from "../context/Web3Context";
import { ethers } from "ethers";
import toast from "react-hot-toast";

export default function Admin() {
  const { account, contracts, config, connectWallet } = useWeb3();
  const [form, setForm] = useState({ name: "", asset: "usdc", apyPercent: "", lockDays: "0", minDeposit: "50", maxDeposit: "100000", capacity: "1000000", earlyExitPercent: "0" });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!account) { connectWallet(); return; }
    if (!form.name || !form.apyPercent) { toast.error("Fill all fields"); return; }
    setLoading(true);
    try {
      const assetAddr = form.asset === "usdc" ? config.usdc : config.usdt;
      const tx = await contracts.vault.createPool(
        form.name,
        assetAddr,
        Math.round(parseFloat(form.apyPercent) * 100),
        parseInt(form.lockDays) * 86400,
        ethers.parseUnits(form.minDeposit, 6),
        ethers.parseUnits(form.maxDeposit, 6),
        ethers.parseUnits(form.capacity, 6),
        Math.round(parseFloat(form.earlyExitPercent) * 100),
      );
      await tx.wait();
      toast.success(`Pool "${form.name}" created!`);
      setForm({ name: "", asset: "usdc", apyPercent: "", lockDays: "0", minDeposit: "50", maxDeposit: "100000", capacity: "1000000", earlyExitPercent: "0" });
    } catch (e) { toast.error(e.reason || e.message || "Failed"); }
    setLoading(false);
  };

  if (!account) return (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center">
      <h2 className="font-display font-bold text-2xl mb-4">Connect Wallet</h2>
      <p className="text-muted mb-6">Owner wallet required to manage pools.</p>
      <button onClick={connectWallet} className="btn-primary">Connect Wallet</button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="font-display font-bold text-3xl mb-2">Create New Vault</h1>
      <p className="text-muted mb-8">Deploy a new staking vault smart contract</p>

      <div className="glass p-7 space-y-5">
        <div>
          <label className="text-sm text-muted mb-2 block">Vault Name</label>
          <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. USDC 90-Day Growth Vault" className="input-field" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted mb-2 block">Asset</label>
            <select value={form.asset} onChange={e => set("asset", e.target.value)} className="input-field">
              <option value="usdc">USDC</option>
              <option value="usdt">USDT</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-muted mb-2 block">APY (%)</label>
            <input type="number" value={form.apyPercent} onChange={e => set("apyPercent", e.target.value)} placeholder="18" className="input-field" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted mb-2 block">Lock Period (Days)</label>
            <input type="number" value={form.lockDays} onChange={e => set("lockDays", e.target.value)} placeholder="0 = flexible" className="input-field" />
          </div>
          <div>
            <label className="text-sm text-muted mb-2 block">Early Exit Fee (%)</label>
            <input type="number" value={form.earlyExitPercent} onChange={e => set("earlyExitPercent", e.target.value)} placeholder="5" className="input-field" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-muted mb-2 block">Min Deposit</label>
            <input type="number" value={form.minDeposit} onChange={e => set("minDeposit", e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="text-sm text-muted mb-2 block">Max Deposit</label>
            <input type="number" value={form.maxDeposit} onChange={e => set("maxDeposit", e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="text-sm text-muted mb-2 block">Total Capacity</label>
            <input type="number" value={form.capacity} onChange={e => set("capacity", e.target.value)} className="input-field" />
          </div>
        </div>

        {form.apyPercent && (
          <div className="bg-surface-2/50 rounded-xl p-4 border border-surface-4/30">
            <div className="text-xs text-muted mb-2 uppercase tracking-wider">Preview</div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-muted">APY:</span> <span className="text-brand font-bold">{form.apyPercent}%</span></div>
              <div><span className="text-muted">Monthly:</span> <span className="font-semibold">{(form.apyPercent / 12).toFixed(2)}%</span></div>
              <div><span className="text-muted">Lock:</span> <span className="font-semibold">{form.lockDays > 0 ? `${form.lockDays}d` : "Flex"}</span></div>
            </div>
          </div>
        )}

        <button onClick={handleCreate} disabled={loading} className="btn-primary w-full py-4 text-base disabled:opacity-50">
          {loading ? "Deploying Vault..." : "Create Vault"}
        </button>
      </div>
    </div>
  );
}
