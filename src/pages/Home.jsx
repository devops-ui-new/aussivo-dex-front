import { API } from "../config/api";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatsBar from "../components/StatsBar";
import PoolCard from "../components/PoolCard";
import heroPlatform from "../assets/home/airdrops_v4 1.png";
import referralIllustration from "../assets/home/referral-illustration.png";

export default function Home() {
  const [pools, setPools] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/pools`).then(r => r.json()).then(setPools).catch(() => {});
  }, []);

  const topPools = pools.filter(p => p.active).slice(0, 3);
  const howItWorksSteps = [
    { step: "1", title: "Connect Wallet" },
    { step: "2", title: "Choose A Vault" },
    { step: "3", title: "Earn Yield" },
  ];

  return (
    <div>
      <section className="relative -mt-[82px] pt-[82px] overflow-hidden border-b border-surface-3/40">
        <div className="absolute inset-y-0 right-0 w-[60%] pointer-events-none">
          <img
            src={heroPlatform}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-[65%_78%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060b18]/70 via-transparent to-transparent" />
        </div>

        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[760px] h-[260px] rounded-full opacity-30 blur-[100px]"
          style={{ background: "radial-gradient(circle, rgba(0,230,118,0.2) 0%, transparent 75%)" }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-10 pb-14 lg:pt-12 lg:pb-16">
          <div className="grid lg:grid-cols-[1.15fr_1fr] gap-10 items-center">
            <div>
              <h1 className="font-display font-semibold text-3xl md:text-4xl lg:text-5xl leading-[1.12] tracking-tight mb-5">
                <span className="block text-slate-100">Earn Yield on</span>
                <span className="block text-gradient">Stablecoins</span>
                <span className="block text-slate-100">Without the Complexity</span>
              </h1>

              <p className="text-sm md:text-base text-slate-400 max-w-xl mb-8 leading-relaxed">
                Deposit USDC or USDT into audited vaults. Earn up to 18% APY from institutional-grade strategies.
                Fully on-chain. Fully transparent.
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-8">
                <Link to="/pools" className="btn-primary text-sm md:text-base px-7 py-3">Start Earning</Link>
                <a href="#how-it-works" className="btn-secondary text-sm md:text-base px-7 py-3">How It Works</a>
              </div>

              <div className="flex flex-wrap items-center gap-4 md:gap-6 text-[11px] text-muted tracking-wide">
                <span>•Audited Contracts</span>
                <span>•Non-custodial</span>
                <span>•Real Time Rewards</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-10"><StatsBar /></section>

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

      <section id="how-it-works" className="max-w-7xl mx-auto px-6 mb-24">
        <div className="text-center mb-10">
          <h2 className="font-display font-bold text-3xl mb-3">How It Works</h2>
          <p className="text-muted max-w-lg mx-auto">Three steps to start earning yield on your stablecoins</p>
        </div>
        <div className="relative grid md:grid-cols-3 gap-6 md:gap-12 lg:gap-20 max-w-5xl mx-auto">
          <div className="hidden md:block absolute top-[84px] left-[22%] right-[22%] h-px bg-brand/40" />
          {howItWorksSteps.map((item) => (
            <div key={item.step} className="relative flex items-center justify-center">
              <div className="w-[170px] h-[170px] rounded-full border border-brand/40 bg-[radial-gradient(circle_at_20%_50%,rgba(0,230,118,0.08),rgba(0,0,0,0.08))] flex flex-col items-center justify-center">
                <div className="w-11 h-11 rounded-full bg-brand/25 text-brand font-display font-bold flex items-center justify-center mb-3">
                  {item.step}
                </div>
                <h3 className="font-display font-medium text-2xl leading-[1.15] max-w-[110px]">{item.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 mb-16">
        <div className="glass p-6 md:p-8 glow-green border-brand/35"
          style={{ background: "linear-gradient(90deg, rgba(2,23,13,0.96) 0%, rgba(5,49,28,0.92) 45%, rgba(10,16,28,0.92) 100%)" }}>
          <div className="grid md:grid-cols-[1fr_280px] gap-8 items-center">
            <div>
              <h2 className="font-display font-bold text-4xl md:text-5xl leading-tight mb-4">Earn More with Referrals</h2>
              <p className="text-slate-300 text-base max-w-lg mb-6">
                Share your link and earn 5% to 8% L1 + 2% to 3% L2 commissions from protocol fees.
              </p>
              <Link to="/referral" className="btn-primary inline-block">Get Referral Link</Link>
            </div>
            <img src={referralIllustration} alt="Referral rewards" className="w-full max-w-[280px] justify-self-center" />
          </div>
        </div>
      </section>
    </div>
  );
}
