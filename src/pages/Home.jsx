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
    { step: "1", line1: "Connect", line2: "Wallet" },
    { step: "2", line1: "Choose A", line2: "Vault" },
    { step: "3", line1: "Earn", line2: "Yield" },
  ];

  return (
    <div>
      <section className="relative -mt-[82px] pt-[82px] overflow-hidden border-b border-surface-3/40">
        <div className="absolute inset-y-0 right-0 w-[65%] pointer-events-none">
          <img
            src={heroPlatform}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-[65%_78%]"
          />
          {/* Bridge gradient to match the darker grid background on the left. */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#060b18]/95 via-[#060b18]/35 to-transparent" />
          {/* Extra edge smoothing where the hero image begins. */}
          <div className="absolute left-0 top-0 bottom-0 w-[35%] bg-gradient-to-r from-[#060b18]/80 via-[#060b18]/35 to-transparent" />
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
        <div className="relative mb-8">
          <div className="text-center">
            <h2 className="font-display font-bold text-3xl text-slate-100 mb-2">Top Vaults</h2>
            <p className="text-muted max-w-lg mx-auto">Curated yield strategies, on-chain and verifiable</p>
          </div>
          <Link to="/pools" className="btn-primary !text-sm !py-2 !px-4 absolute right-0 top-1/2 -translate-y-1/2 hidden md:inline-flex">View All →</Link>
        </div>
        <div className="flex justify-center mb-5 md:hidden">
          <Link to="/pools" className="btn-primary !text-sm !py-2 !px-4">View All →</Link>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {topPools.map(pool => <PoolCard key={pool.id} pool={pool} variant="home-dark" />)}
          {topPools.length === 0 && [0,1,2].map(i => <div key={i} className="glass p-6 h-[320px] shimmer" />)}
        </div>
      </section>

      <section id="how-it-works" className="max-w-7xl mx-auto px-6 mb-24">
        <div className="text-center mb-10">
          <h2 className="font-display font-bold text-3xl mb-3">How It Works</h2>
          <p className="text-muted max-w-lg mx-auto">Three steps to start earning yield on your stablecoins</p>
        </div>
        <div className="relative grid md:grid-cols-3 gap-6 md:gap-12 lg:gap-20 max-w-5xl mx-auto">
          {/* connector lines between circles */}
          <div className="hidden md:block absolute top-[84px] left-[22%] w-[18%] h-[1px] pointer-events-none bg-gradient-to-r from-transparent via-[#00e676] to-transparent opacity-90" />
          <div className="hidden md:block absolute top-[84px] right-[22%] w-[18%] h-[1px] pointer-events-none bg-gradient-to-r from-transparent via-[#00e676] to-transparent opacity-90" />
          {/* glow highlight based on provided spec (72.2869px square, 0deg) */}
          <div
            className="hidden md:block absolute pointer-events-none"
            style={{
              width: "72.28699493408203px",
              height: "72.28699493408203px",
              top: "60.63px",
              left: "94.44px",
              opacity: 1,
              background:
                "linear-gradient(90deg, rgba(15,23,42,0) 0%, rgba(0,230,118,0.85) 50%, rgba(15,23,42,0) 100%)",
              filter: "blur(16px)",
            }}
          />
          <div
            className="hidden md:block absolute pointer-events-none"
            style={{
              width: "72.28699493408203px",
              height: "72.28699493408203px",
              top: "60.63px",
              right: "94.44px",
              opacity: 1,
              background:
                "linear-gradient(90deg, rgba(15,23,42,0) 0%, rgba(0,230,118,0.85) 50%, rgba(15,23,42,0) 100%)",
              filter: "blur(16px)",
            }}
          />
          {howItWorksSteps.map((item) => (
            <div key={item.step} className="relative z-10 flex items-center justify-center">
              <div className="relative w-[170px] h-[170px] rounded-full border-[2.33px] border-brand/35 bg-[#020707] shadow-[0_0_8px_rgba(0,230,118,0.06)] flex flex-col items-center justify-center">
                <div
                  className="relative w-11 h-11 rounded-full border border-brand/30 text-[#69f0ae] font-display font-bold flex items-center justify-center mb-3 shadow-[inset_0_0_8px_rgba(0,230,118,0.22),0_0_10px_rgba(0,230,118,0.12)]"
                  style={{ background: "linear-gradient(90deg, rgba(56, 255, 126, 0.3) 0%, rgba(10, 210, 90, 0.27) 100%)" }}
                >
                  {item.step}
                </div>
                <h3 className="font-display font-medium text-[15px] leading-[1.2] text-center">
                  <span className="block">{item.line1}</span>
                  <span className="block">{item.line2}</span>
                </h3>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 mb-16">
        <div
          className="relative overflow-hidden rounded-2xl border border-brand/55 shadow-[0_0_18px_rgba(0,230,118,0.4),0_0_48px_rgba(0,230,118,0.18)]"
          style={{ background: "linear-gradient(90deg, rgba(2,12,8,0.95) 0%, rgba(4,12,10,0.91) 48%, rgba(10,16,28,0.94) 100%)" }}
        >
          <div className="absolute left-0 top-0 h-full w-[62%] bg-[radial-gradient(circle_at_35%_50%,rgba(0,230,118,0.23)_0%,rgba(0,230,118,0.10)_36%,rgba(0,0,0,0)_76%)] pointer-events-none z-0" />
          <div className="relative z-10 grid md:grid-cols-[1fr_260px] gap-8 items-center p-5 md:p-7">
            <div className="md:ml-[50px]">
              <h2 className="font-display font-bold text-4xl md:text-5xl leading-tight mb-4">
                Earn More with
                <br />
                Referrals
              </h2>
              <p className="text-slate-300 text-base max-w-lg mb-6">
                Share your link and earn 5% to 8% L1 + 2% to 3% L2
                <br />
                commissions from protocol fees.
              </p>
              <Link to="/referral" className="btn-primary inline-block">Get Referral Link</Link>
            </div>
            <div className="justify-self-center md:justify-self-end">
              <img src={referralIllustration} alt="Referral rewards" className="w-full max-w-[260px]" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
