import { useEffect, useState } from 'react';
import { formatClock, formatUsd } from '../lib/format';
import { useHlAccount } from '../state/account';
import { HL_NETWORK, IS_TESTNET } from '../config';

function signedUsd(v: number): { text: string; cls: string } {
  return { text: `${v >= 0 ? '+' : '-'}${formatUsd(Math.abs(v))}`, cls: v >= 0 ? 'up' : 'down' };
}

export function StatusBar() {
  const [now, setNow] = useState(() => new Date());
  const { positions, openOrders } = useHlAccount();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  let longs = 0;
  let shorts = 0;
  let upnl = 0;
  for (const { position: p } of positions) {
    const v = Number(p.positionValue);
    if (Number(p.szi) > 0) longs += v;
    else shorts += v;
    upnl += Number(p.unrealizedPnl);
  }
  const open = longs + shorts;
  const delta = signedUsd(longs - shorts);
  const u = signedUsd(upnl);
  const ordersNotional = openOrders.reduce((s, o) => s + Number(o.sz) * Number(o.limitPx), 0);

  return (
    <div className="statusbar">
      <span>
        Open: <span className="num">{formatUsd(open, { compact: true })}</span>
      </span>
      <span>
        Longs: <span className="num">{formatUsd(longs, { compact: true })}</span>
      </span>
      <span>
        Shorts: <span className="num">{formatUsd(shorts, { compact: true })}</span>
      </span>
      <span>
        Delta: <span className={`num ${delta.cls}`}>{delta.text}</span>
      </span>
      <span>
        UPnL: <span className={`num ${u.cls}`}>{u.text}</span>
      </span>
      <span>
        Orders:{' '}
        <span className="num">
          {openOrders.length} ({formatUsd(ordersNotional, { compact: true })})
        </span>
      </span>
      <span className="statusbar__right">
        {/* Which Hyperliquid this build talks to. Mainnet spends real USDC, so
            it must be visible somewhere at all times, not only under ⚙. */}
        <span className={`statusbar__net${IS_TESTNET ? ' statusbar__net--test' : ''}`}>
          {HL_NETWORK}
        </span>
        <span className="num">{formatClock(now)}</span>
        <span>
          <span className="dot dot--on" />
          Live
        </span>
      </span>
    </div>
  );
}
