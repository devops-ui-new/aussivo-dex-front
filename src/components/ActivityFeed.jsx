import { useEffect, useRef, useState } from "react";
import { API } from "../config/api";
import Avatar from "./Avatar";

const KIND = {
  deposit:  { verb: "deposited", color: "#34d399", bg: "bg-emerald-500/15", icon: "M12 3v18M5 10l7-7 7 7" },
  withdraw: { verb: "withdrew",  color: "#60a5fa", bg: "bg-blue-500/15",    icon: "M12 21V3M5 14l7 7 7-7" },
  redeem:   { verb: "redeemed",  color: "#f59e0b", bg: "bg-amber-500/15",   icon: "M12 21V3M5 14l7 7 7-7" },
  yield:    { verb: "earned",    color: "#22d3ee", bg: "bg-cyan-500/15",    icon: "M20 6L9 17l-5-5" },
};

const timeAgo = (at) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(at).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const fmtAmt = (n) => { const x = Number(n) || 0; return x >= 1000 ? `$${(x / 1000).toFixed(1)}K` : `$${x.toLocaleString()}`; };

/**
 * ActivityFeed — a live "protocol is alive and used" feed of recent, masked on-platform events
 * from GET /api/activity/recent. Auto-refreshes; renders nothing if there's no activity.
 */
export default function ActivityFeed({ limit = 8, className = "" }) {
  const [events, setEvents] = useState([]);
  const [flash, setFlash] = useState(false);
  const topId = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      fetch(`${API}/api/activity/recent?limit=${limit}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled || !d?.events) return;
          const sig = `${d.events[0]?.actor}:${d.events[0]?.at}`;
          if (topId.current && sig !== topId.current) { setFlash(true); setTimeout(() => !cancelled && setFlash(false), 900); }
          topId.current = sig;
          setEvents(d.events);
        })
        .catch(() => {});
    };
    pull();
    const iv = setInterval(pull, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [limit]);

  if (!events.length) return null;

  return (
    <div className={`glass overflow-hidden ${className}`}>
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full bg-emerald-400 ${flash ? "animate-ping" : "animate-pulse"}`} />
          <span className="font-display text-sm font-semibold text-white">Live activity</span>
        </div>
        <span className="text-[11px] text-muted">on-chain settlements</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {events.map((e, i) => {
          const k = KIND[e.type] || KIND.deposit;
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="relative shrink-0">
                <span className="block h-8 w-8 overflow-hidden rounded-full border-2" style={{ borderColor: k.color }}>
                  <Avatar seed={e.actor} style="bottts" size={32} radius={50} className="h-full w-full" />
                </span>
                <span className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ${k.bg} ring-2 ring-surface-1`}>
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke={k.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d={k.icon} /></svg>
                </span>
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <span className="font-mono text-slate-300">{e.actor}</span>
                <span className="text-slate-500"> {k.verb} </span>
                <span className="font-semibold text-slate-100">{fmtAmt(e.amount)} {e.asset}</span>
                {e.vault && <span className="text-slate-500"> · {e.vault}</span>}
              </div>
              <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(e.at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}