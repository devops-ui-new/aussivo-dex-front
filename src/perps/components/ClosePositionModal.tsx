import { useState } from 'react';
import { formatPx, formatSz, formatUsd } from '../lib/format';
import type { AssetPosition } from '../lib/types';
import { useMarket, type MarketInfo } from '../state/market';
import { useTrading } from '../state/trading';

const QUICK_PCTS = [25, 50, 75, 100];

/**
 * Confirm and size a position close.
 *
 * Replaces the old inline 50%/Market buttons, which fired a real market order
 * on a single click with no confirmation and no way to pick any other amount.
 * Closing is sized here — any fraction, or the whole position.
 */
export function ClosePositionModal({
  position,
  market,
  onClose,
}: {
  position: AssetPosition;
  market: MarketInfo;
  onClose: () => void;
}) {
  const p = position.position;
  const szi = Number(p.szi);
  const isLong = szi > 0;
  const total = Math.abs(szi);
  const { szDecimals } = market.meta;
  const trading = useTrading();

  const [pct, setPct] = useState(100);
  // Size is the source of truth; the slider writes to it, and typing a size
  // updates the slider. Kept as a string so the field stays editable mid-typing.
  const [size, setSize] = useState(total.toFixed(szDecimals));
  const [busy, setBusy] = useState(false);

  const szNum = Number(size) || 0;
  const mark = Number(market.ctx.markPx ?? 0);
  const upnl = Number(p.unrealizedPnl);
  const dec = szDecimals;
  const dp = formatPx(mark, dec);

  const applyPct = (v: number) => {
    setPct(v);
    setSize(((total * v) / 100).toFixed(dec));
  };

  const remaining = Math.max(0, total - szNum);
  const proceeds = szNum * mark;
  // uPnL is realised in proportion to how much of the position is closed.
  const realised = total > 0 ? (upnl * szNum) / total : 0;

  const error =
    szNum <= 0
      ? 'Enter an amount'
      : szNum > total + Number.EPSILON
        ? 'Exceeds position size'
        : trading.status !== 'ready'
          ? 'Trading is not enabled'
          : null;

  const submit = async () => {
    if (error || busy) return;
    setBusy(true);
    try {
      // closePosition takes a fraction of the position; clamp so float noise in
      // size/total can never ask to close more than is actually open.
      const fraction = Math.min(1, szNum / total);
      await trading.closePosition(market, szi, fraction);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Close {p.coin} position</h3>
          <button className="modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="fund__bals">
          <div className="kv">
            <span className="dim">Position</span>
            <span className="num">
              <span className={isLong ? 'up' : 'down'}>{isLong ? 'Long' : 'Short'}</span>{' '}
              {formatSz(total, dec)} {p.coin}
            </span>
          </div>
          <div className="kv">
            <span className="dim">Entry / Mark</span>
            <span className="num">
              {p.entryPx ? formatPx(Number(p.entryPx), dec) : '—'} / {dp}
            </span>
          </div>
          <div className="kv">
            <span className="dim">Unrealised PNL</span>
            <span className={`num ${upnl >= 0 ? 'up' : 'down'}`}>
              {upnl >= 0 ? '+' : '-'}
              {formatUsd(Math.abs(upnl))}
            </span>
          </div>
        </div>

        <div className="fieldrow" style={{ marginTop: 12 }}>
          <div className="field field--half">
            <input
              value={size}
              inputMode="decimal"
              placeholder="0"
              onChange={(e) => {
                setSize(e.target.value);
                const n = Number(e.target.value) || 0;
                setPct(total > 0 ? Math.min(100, Math.round((n / total) * 100)) : 0);
              }}
            />
            <span className="field__unit">{p.coin}</span>
          </div>
          <div className="field field--half">
            <input readOnly value={szNum > 0 ? proceeds.toFixed(2) : ''} placeholder="0" />
            <span className="field__unit">USDC</span>
          </div>
        </div>

        <div className="slider" style={{ marginTop: 10 }}>
          <div className="sliderrow">
            <input
              type="range"
              min={0}
              max={100}
              value={pct}
              style={{ '--fill': `${pct}%` } as React.CSSProperties}
              onChange={(e) => applyPct(Number(e.target.value))}
            />
            <div className="pctbox">
              <input
                value={pct}
                inputMode="numeric"
                onChange={(e) => applyPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              />
              <span>%</span>
            </div>
          </div>
          <div className="slider__marks">
            {QUICK_PCTS.map((q) => (
              <button key={q} className="closepct" onClick={() => applyPct(q)}>
                {q}%
              </button>
            ))}
          </div>
        </div>

        <div className="fund__bals" style={{ marginTop: 12 }}>
          <div className="kv">
            <span className="dim">Realised PNL (est.)</span>
            <span className={`num ${realised >= 0 ? 'up' : 'down'}`}>
              {realised >= 0 ? '+' : '-'}
              {formatUsd(Math.abs(realised))}
            </span>
          </div>
          <div className="kv">
            <span className="dim">Remaining after close</span>
            <span className="num">
              {remaining <= 0 ? 'None — fully closed' : `${formatSz(remaining, dec)} ${p.coin}`}
            </span>
          </div>
        </div>

        <div className="modal__note">
          Closes at market as a reduce-only IOC order. The fill price may differ from the mark.
        </div>

        {error && szNum > 0 && <div className="modal__error">{error}</div>}

        <button
          className="ticket__cta ticket__cta--connect"
          style={{ marginTop: 12, opacity: error || busy ? 0.55 : 1 }}
          disabled={!!error || busy}
          onClick={() => void submit()}
        >
          {busy
            ? 'Closing…'
            : remaining <= 0
              ? `Close full position`
              : `Close ${formatSz(szNum, dec)} ${p.coin}`}
        </button>
      </div>
    </div>
  );
}

/** Convenience wrapper: resolves the market for a position before rendering. */
export function ClosePositionModalFor({
  position,
  onClose,
}: {
  position: AssetPosition;
  onClose: () => void;
}) {
  const { markets } = useMarket();
  const market = markets.get(position.position.coin);
  if (!market) return null;
  return <ClosePositionModal position={position} market={market} onClose={onClose} />;
}
