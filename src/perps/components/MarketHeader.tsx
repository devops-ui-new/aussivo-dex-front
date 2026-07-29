import { useEffect, useRef, useState } from 'react';
import { formatCountdown, formatPct, formatPx, formatUsd } from '../lib/format';
import { useMarket, useMid } from '../state/market';
import { MarketPicker } from './MarketPicker';

const COIN_COLORS: Record<string, string> = {
  BTC: '#f7931a',
  ETH: '#627eea',
  SOL: '#9945ff',
  HYPE: '#2ebd85',
};

function useFundingCountdown(): string {
  // Hyperliquid funding settles hourly on the hour.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const next = Math.ceil(now / 3_600_000) * 3_600_000;
  return formatCountdown(next - now);
}

export function MarketHeader() {
  const { coin, market } = useMarket();
  const mid = useMid(coin);
  const countdown = useFundingCountdown();
  const [open, setOpen] = useState(false);
  const coinRef = useRef<HTMLDivElement>(null);

  if (!market) {
    return (
      <div className="mkthead">
        <span className="dim">Loading markets…</span>
      </div>
    );
  }

  const { szDecimals } = market.meta;
  const prev = Number(market.ctx.prevDayPx);
  const chgAbs = mid - prev;
  const chgPct = prev > 0 ? mid / prev - 1 : 0;

  return (
    <div className="mkthead">
      <div className="mkthead__coin" ref={coinRef} onClick={() => setOpen((v) => !v)}>
        <span className="coin-icon" style={{ background: COIN_COLORS[coin] ?? '#444' }}>
          {coin.slice(0, 1)}
        </span>
        {coin}-USDC <span className="mkthead__caret">▼</span>
      </div>
      {open && coinRef.current && (
        <MarketPicker anchor={coinRef.current} onClose={() => setOpen(false)} />
      )}

      <div className="stat">
        <span className="stat__label">Mark</span>
        <span className="stat__value num">{formatPx(Number(market.ctx.markPx), szDecimals)}</span>
      </div>
      <div className="stat">
        <span className="stat__label">Oracle</span>
        <span className="stat__value num">{formatPx(Number(market.ctx.oraclePx), szDecimals)}</span>
      </div>
      <div className="stat">
        <span className="stat__label">24h Change</span>
        <span className={`stat__value num ${chgPct >= 0 ? 'up' : 'down'}`}>
          {chgAbs >= 0 ? '+' : ''}
          {formatPx(Math.abs(chgAbs) * Math.sign(chgAbs), szDecimals)} / {formatPct(chgPct)}
        </span>
      </div>
      <div className="stat">
        <span className="stat__label">24h Vol</span>
        <span className="stat__value num">{formatUsd(Number(market.ctx.dayNtlVlm))}</span>
      </div>
      <div className="stat">
        <span className="stat__label">Open Interest</span>
        <span className="stat__value num">
          {formatUsd(Number(market.ctx.openInterest) * Number(market.ctx.markPx))}
        </span>
      </div>
      <div className="stat">
        <span className="stat__label">Funding / Countdown</span>
        <span className="stat__value num">
          <span className={Number(market.ctx.funding) >= 0 ? 'up' : 'down'}>
            {formatPct(Number(market.ctx.funding), 4)}
          </span>{' '}
          / {countdown}
        </span>
      </div>
    </div>
  );
}
