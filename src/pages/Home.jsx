import { API } from "../config/api";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatsBar from "../components/StatsBar";
import PoolCard from "../components/PoolCard";

export default function Home() {
  const [pools, setPools] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/pools`).then(r => r.json()).then(setPools).catch(() => {});
  }, []);

  const topPools = pools.filter(p => p.active).slice(0, 3);

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-20 blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(0,230,118,0.15) 0%, transparent 70%)" }} />
        <div className="absolute top-40 right-10 w-2 h-2 rounded-full bg-brand/40 animate-pulse" />
        <div className="absolute top-60 left-20 w-1.5 h-1.5 rounded-full bg-brand/30 animate-pulse" style={{ animationDelay: "1s" }} />

        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-brand/5 border border-brand/15 rounded-full px-4 py-1.5 mb-8">
              <div className="pulse-dot" style={{ width: 6, height: 6 }} />
              <span className="text-xs font-medium text-brand/80 tracking-wide">PROTOCOL LIVE ON ARBITRUM</span>
            </div>

            <h1 className="font-display font-extrabold text-5xl md:text-6xl lg:text-7xl leading-[1.08] tracking-tight mb-6">
              Earn Yield on{" "}
              <span className="text-gradient">Stablecoins</span>
              <br />
              <span className="text-slate-400 text-4xl md:text-5xl lg:text-[3.5rem] font-bold">Without the Complexity</span>
            </h1>

            <p className="text-lg text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed">
              Deposit USDC or USDT into audited vaults. Earn up to 18% APY from
              institutional-grade strategies. Fully on-chain. Fully transparent.
            </p>

            <div className="flex items-center justify-center gap-4 mb-6">
              <Link to="/pools" className="btn-primary text-base px-8 py-3.5">Start Earning</Link>
              <a href="#how-it-works" className="btn-secondary text-base px-8 py-3.5">How It Works</a>
            </div>

            <div className="flex items-center justify-center gap-8 mt-12 text-xs text-muted">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Audited Contracts</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                <span>Non-Custodial</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                <span>Real-Time Rewards</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 -mt-4 mb-16"><StatsBar /></section>

      <section className="max-w-7xl mx-auto px-6 mb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display font-bold text-2xl mb-1">Top Vaults</h2>
            <p className="text-sm text-muted">Curated yield strategies, on-chain and verifiable</p>
          </div>
          <Link to="/pools" className="btn-secondary text-sm py-2.5 px-5">View All →</Link>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {topPools.map(pool => <PoolCard key={pool.id} pool={pool} />)}
          {topPools.length === 0 && [0,1,2].map(i => <div key={i} className="glass p-6 h-[240px] shimmer" />)}
        </div>
      </section>

      <section id="how-it-works" className="max-w-7xl mx-auto px-6 mb-20">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl mb-3">How It Works</h2>
          <p className="text-muted max-w-lg mx-auto">Three steps to start earning yield on your stablecoins</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: "01", title: "Connect Wallet", desc: "Link MetaMask or WalletConnect. No registration, fully permissionless." },
            { step: "02", title: "Choose a Vault", desc: "Compare APY rates, lock periods, and risk profiles across vaults." },
            { step: "03", title: "Earn Yield", desc: "Deposit USDC or USDT. Watch rewards accrue in real-time." },
          ].map((item, i) => (
            <div key={i} className="glass p-7 text-center">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-brand/8 border border-brand/15 flex items-center justify-center">
                <span className="font-display font-bold text-brand text-lg">{item.step}</span>
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 mb-16">
        <div className="glass p-8 text-center glow-green" style={{ background: "linear-gradient(135deg, rgba(0,230,118,0.06) 0%, rgba(11,17,33,0.95) 100%)" }}>
          <h2 className="font-display font-bold text-2xl mb-3">Earn More with Referrals</h2>
          <p className="text-muted text-sm max-w-md mx-auto mb-6">
            Share your link and earn 5-8% L1 + 2-3% L2 commissions from protocol fees.
          </p>
          <Link to="/referral" className="btn-primary inline-block">Get Referral Link →</Link>
        </div>
      </section>
    </div>
  );
}
