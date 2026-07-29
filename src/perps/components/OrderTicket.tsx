import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { formatSz, formatUsd, pxDecimals } from '../lib/format';
import { useHlAccount } from '../state/account';
import { useMarket, useMid } from '../state/market';
import { useTrading } from '../state/trading';
import { useAussivoWallet } from '../lib/aussivoWallet';

export type Side = 'buy' | 'sell';
type OrderType = 'Market' | 'Limit' | 'Stop Market' | 'Stop Limit' | 'Scale' | 'TWAP' | 'Scalp';
const ORDER_TYPES: OrderType[] = [
  'Market',
  'Limit',
  'Stop Market',
  'Stop Limit',
  'Scale',
  'TWAP',
  'Scalp',
];

const MIN_NOTIONAL_USD = 10; // Hyperliquid minimum order value
type Tif = 'Gtc' | 'Ioc' | 'Alo';

/** Green/red quick-set dots: bid and ask (Hyperliquid impact prices). */
function PxDots({ onPick, bid, ask }: { onPick: (px: number) => void; bid: number; ask: number }) {
  return (
    <span className="pxdots">
      <button
        className="pxdot pxdot--bid"
        title="Use bid price"
        onClick={() => bid > 0 && onPick(bid)}
      />
      <button
        className="pxdot pxdot--ask"
        title="Use ask price"
        onClick={() => ask > 0 && onPick(ask)}
      />
    </span>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="field field--half stepper">
      <span className="field__unit">{label}</span>
      <span className="num stepper__val">{value}</span>
      <span className="stepper__btns">
        <button onClick={() => onChange(Math.min(max, value + 1))}>+</button>
        <button onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      </span>
    </div>
  );
}

export function OrderTicket({ pickedPrice }: { pickedPrice: number | null }) {
  const { coin, market } = useMarket();
  const mid = useMid(coin);
  const maxLev = market?.meta.maxLeverage ?? 40;
  const szDecimals = market?.meta.szDecimals ?? 4;
  // Gate on the app wallet, not wagmi's: the bridge attaches wagmi a beat after
  // Web3Context connects, and gating on wagmi would flash "Connect Wallet" at a
  // user who is already connected.
  const { account, connectWallet } = useAussivoWallet();
  const isConnected = !!account;
  const { clearinghouse, positionFor, spotUsdc, isUnified } = useHlAccount();
  const trading = useTrading();
  const [connecting, setConnecting] = useState(false);

  const dp = pxDecimals(szDecimals, mid || 1);
  const tick = 10 ** -dp;
  const bid = Number(market?.ctx.impactPxs?.[0] ?? 0) || mid;
  const ask = Number(market?.ctx.impactPxs?.[1] ?? 0) || mid;

  const [side, setSide] = useState<Side>('buy');
  const [type, setType] = useState<OrderType>('Market');
  const [typeOpen, setTypeOpen] = useState(false);
  const [marginMode, setMarginMode] = useState<'cross' | 'isolated'>('cross');
  const [marginOpen, setMarginOpen] = useState(false);
  const [marginDraft, setMarginDraft] = useState<'cross' | 'isolated'>('cross');
  const [leverage, setLeverageLocal] = useState(Math.min(20, maxLev));
  const [levOpen, setLevOpen] = useState(false);
  const [levDraft, setLevDraft] = useState(Math.min(20, maxLev));

  const [price, setPrice] = useState('');
  const [trigger, setTrigger] = useState('');
  const [size, setSize] = useState('');
  const [pct, setPct] = useState(0);
  /**
   * What the user has typed into the USDC field, while they are typing it.
   *
   * The USDC and coin fields are two views of one quantity, but `size` is the
   * stored truth and is rounded to szDecimals. Echoing back `size * price` on
   * every keystroke would fight the user — typing "1" into USDC becomes a size
   * of 0.0000 BTC, which renders as "0.00" USDC and eats the input. So while
   * the USDC field has focus we show exactly what was typed; null means "not
   * editing, mirror the coin size".
   */
  const [usdDraft, setUsdDraft] = useState<string | null>(null);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpslOn, setTpslOn] = useState(false);
  const [tpPx, setTpPx] = useState('');
  const [slPx, setSlPx] = useState('');
  const [tif, setTif] = useState<Tif>('Gtc');
  const [maxSlip, setMaxSlip] = useState(8); // percent
  const [slipEdit, setSlipEdit] = useState(false);

  // Scale
  const [startPx, setStartPx] = useState('');
  const [endPx, setEndPx] = useState('');
  const [scaleCount, setScaleCount] = useState('5');
  const [scaleSkew, setScaleSkew] = useState('1');
  // TWAP
  const [twapH, setTwapH] = useState(0);
  const [twapM, setTwapM] = useState(5);
  const [twapRandom, setTwapRandom] = useState(false);
  const [twapReduce, setTwapReduce] = useState(false);
  // Scalp (per side)
  const [ticksL, setTicksL] = useState('1');
  const [ticksR, setTicksR] = useState('1');
  const [hkL, setHkL] = useState('');
  const [hkR, setHkR] = useState('');
  const [reduceL, setReduceL] = useState(false);
  const [reduceR, setReduceR] = useState(false);

  // On a unified account Spot and Perps are one balance sheet: the perps
  // `withdrawable` reads 0 until there is a position, while the usable margin
  // sits in Spot. Reading only the perps field showed "0.00" on a funded account.
  const availableUsdc = Number(clearinghouse?.withdrawable ?? 0) + (isUnified ? spotUsdc : 0);
  const positionSz = Number(positionFor(coin)?.position.szi ?? 0);

  useEffect(() => {
    setLeverageLocal((l) => Math.min(l, maxLev));
  }, [maxLev]);

  // Reset inputs when switching markets.
  useEffect(() => {
    setPrice('');
    setTrigger('');
    setSize('');
    setPct(0);
    setUsdDraft(null);
    setStartPx('');
    setEndPx('');
  }, [coin]);

  // Book click seeds the limit price.
  useEffect(() => {
    if (pickedPrice !== null) setPrice(String(pickedPrice));
  }, [pickedPrice]);
  useEffect(() => {
    if (price === '' && mid > 0) setPrice(mid.toFixed(dp));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid > 0, coin]);

  const isStop = type === 'Stop Market' || type === 'Stop Limit';
  const needsLimitPx = type === 'Limit' || type === 'Stop Limit';
  const hasTif = type === 'Limit' || type === 'Stop Limit' || type === 'Scale';
  const triggerNum = Number(trigger) || 0;
  const szNum = Number(size) || 0;
  const startNum = Number(startPx) || 0;
  const endNum = Number(endPx) || 0;
  const countNum = Math.max(2, Math.min(50, Number(scaleCount) || 5));
  const skewNum = Math.max(0.1, Number(scaleSkew) || 1);
  const twapMinutes = twapH * 60 + twapM;

  const pxRef =
    type === 'Market' || type === 'TWAP' || type === 'Scalp'
      ? mid
      : type === 'Stop Market'
        ? triggerNum
        : type === 'Scale'
          ? (startNum + endNum) / 2 || 0
          : Number(price) || 0;
  const orderValue = pxRef * szNum;
  const marginReq = leverage > 0 ? orderValue / leverage : 0;
  const estLiq =
    pxRef > 0 && szNum > 0
      ? side === 'buy'
        ? pxRef * (1 - 1 / leverage)
        : pxRef * (1 + 1 / leverage)
      : 0;
  const usdValue = (szNum * pxRef).toFixed(2);
  const estSlip = mid > 0 ? Math.max(0, (side === 'buy' ? ask / mid - 1 : 1 - bid / mid) * 100) : 0;

  // Scale previews: first/last order sizes and weighted average price.
  const scalePreview = useMemo(() => {
    if (szNum <= 0 || countNum < 2) return { first: 0, last: 0, avg: 0 };
    const weights = Array.from(
      { length: countNum },
      (_, i) => 1 + (skewNum - 1) * (i / (countNum - 1)),
    );
    const wSum = weights.reduce((a, b) => a + b, 0);
    const sizes = weights.map((w) => (szNum * w) / wSum);
    const prices = weights.map((_, i) => startNum + ((endNum - startNum) * i) / (countNum - 1));
    const avg = sizes.reduce((a, s, i) => a + s * prices[i], 0) / szNum || 0;
    return { first: sizes[0], last: sizes[countNum - 1], avg };
  }, [szNum, countNum, skewNum, startNum, endNum]);

  const twapOrders = Math.floor((twapMinutes * 60) / 30) + 1;

  // Scalp entries: join the touch, improved toward mid by (ticks-1).
  const entryL = bid > 0 ? bid + (Math.max(1, Number(ticksL) || 1) - 1) * tick : 0;
  const entryR = ask > 0 ? ask - (Math.max(1, Number(ticksR) || 1) - 1) * tick : 0;

  const applyPct = (p: number) => {
    setPct(p);
    const ref = pxRef > 0 ? pxRef : mid;
    if (ref > 0 && availableUsdc > 0) {
      const sz = ((availableUsdc * p) / 100) * (leverage / ref);
      setSize(sz > 0 ? sz.toFixed(szDecimals) : '');
      setUsdDraft(null);
    }
  };

  const tpNum = tpslOn ? Number(tpPx) || 0 : 0;
  const slNum = tpslOn ? Number(slPx) || 0 : 0;

  const validation = useMemo(() => {
    if (trading.status !== 'ready') return null;
    if (!market) return 'Market not loaded';
    if (type === 'Scalp') return null; // per-side buttons validate themselves
    if (szNum <= 0) return 'Enter a size';
    if (needsLimitPx && (Number(price) || 0) <= 0) return 'Enter a price';
    if (isStop && triggerNum <= 0) return 'Enter a trigger price';
    if (type === 'Scale') {
      if (startNum <= 0 || endNum <= 0) return 'Set start and end price';
      if (startNum === endNum) return 'Start and end must differ';
      if (orderValue / countNum < MIN_NOTIONAL_USD)
        return `Each order min ${formatUsd(MIN_NOTIONAL_USD)}`;
    }
    if (type === 'TWAP' && (twapMinutes < 5 || twapMinutes > 1440)) return 'Runtime 5m – 24h';
    if (orderValue < MIN_NOTIONAL_USD) return `Min order ${formatUsd(MIN_NOTIONAL_USD)}`;
    if (tpslOn && (type === 'Market' || type === 'Limit') && !tpNum && !slNum)
      return 'Set a TP or SL price';
    const ref = pxRef;
    if (tpNum > 0 && (side === 'buy' ? tpNum <= ref : tpNum >= ref))
      return side === 'buy' ? 'TP must be above price' : 'TP must be below price';
    if (slNum > 0 && (side === 'buy' ? slNum >= ref : slNum <= ref))
      return side === 'buy' ? 'SL must be below price' : 'SL must be above price';
    return null;
  }, [trading.status, market, type, szNum, price, needsLimitPx, isStop, triggerNum, startNum, endNum, twapMinutes, orderValue, countNum, tpslOn, tpNum, slNum, side, pxRef]);

  const clearAfter = () => {
    setSize('');
    setPct(0);
    setUsdDraft(null);
    setTpPx('');
    setSlPx('');
  };

  const submit = async () => {
    if (!market || validation) return;
    let ok = false;
    if (type === 'Scale') {
      ok = await trading.placeScale({
        market,
        isBuy: side === 'buy',
        startPx: startNum,
        endPx: endNum,
        totalSz: szNum,
        count: countNum,
        skew: skewNum,
        reduceOnly,
        tif,
      });
    } else if (type === 'TWAP') {
      ok = await trading.placeTwap({
        market,
        isBuy: side === 'buy',
        sz: szNum,
        minutes: twapMinutes,
        reduceOnly: twapReduce,
        randomize: twapRandom,
      });
    } else {
      ok = await trading.placeOrder({
        market,
        isBuy: side === 'buy',
        limitPx: Number(price) || 0,
        sz: szNum,
        reduceOnly,
        tif,
        orderKind:
          type === 'Market'
            ? 'market'
            : type === 'Limit'
              ? 'limit'
              : type === 'Stop Market'
                ? 'stopMarket'
                : 'stopLimit',
        mid,
        slippage: maxSlip / 100,
        triggerPx: isStop ? triggerNum : undefined,
        tpPx: !isStop && tpNum > 0 ? tpNum : undefined,
        slPx: !isStop && slNum > 0 ? slNum : undefined,
      });
    }
    if (ok) clearAfter();
  };

  const scalpFire = async (isBuy: boolean) => {
    if (!market || trading.status !== 'ready' || szNum <= 0) return;
    const entry = isBuy ? entryL : entryR;
    if (entry <= 0) return;
    const ok = await trading.placeOrder({
      market,
      isBuy,
      limitPx: entry,
      sz: szNum,
      reduceOnly: isBuy ? reduceL : reduceR,
      tif: 'Alo',
      orderKind: 'limit',
      mid,
    });
    if (ok) clearAfter();
  };

  // Scalp hotkeys — fire a side from the keyboard when not typing in a field.
  useEffect(() => {
    if (type !== 'Scalp') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
      if (hkL && e.key.toLowerCase() === hkL.toLowerCase()) void scalpFire(true);
      if (hkR && e.key.toLowerCase() === hkR.toLowerCase()) void scalpFire(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, hkL, hkR, szNum, entryL, entryR, trading.status, reduceL, reduceR]);

  const gateCta = () => {
    if (!isConnected)
      return (
        <button
          className="ticket__cta ticket__cta--connect"
          disabled={connecting}
          onClick={async () => {
            if (connecting) return;
            setConnecting(true);
            try {
              await connectWallet();
            } finally {
              setConnecting(false);
            }
          }}
        >
          {connecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
      );
    if (trading.status === 'setup')
      return (
        <button
          className="ticket__cta ticket__cta--connect"
          disabled={trading.busy}
          onClick={() => void trading.enableTrading()}
        >
          {trading.busy ? 'Waiting for signatures…' : 'Enable Trading'}
        </button>
      );
    if (trading.status === 'locked')
      return (
        <button
          className="ticket__cta ticket__cta--connect"
          disabled={trading.busy}
          onClick={() => void trading.unlock()}
        >
          {trading.busy ? 'Waiting for signature…' : 'Unlock Trading'}
        </button>
      );
    return null;
  };

  const placeCta = () => {
    const gate = gateCta();
    if (gate) return gate;
    const label = trading.busy
      ? 'Submitting…'
      : type === 'Scale'
        ? `Place ${countNum} Orders`
        : 'Place Order';
    return (
      <button
        className={`ticket__cta ticket__cta--${side}`}
        disabled={trading.busy || validation !== null}
        style={validation || trading.busy ? { opacity: 0.55 } : undefined}
        title={validation ?? undefined}
        onClick={() => void submit()}
      >
        {label}
      </button>
    );
  };

  const priceField = (label: string, value: string, onChange: (v: string) => void) => (
    <div className="field">
      <span className="field__unit">{label}</span>
      <PxDots bid={bid} ask={ask} onPick={(px) => onChange(px.toFixed(dp))} />
      <input
        value={value}
        inputMode="decimal"
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
        style={{ textAlign: 'right' }}
      />
      <span className="field__unit">USDC</span>
    </div>
  );

  const sizeRow = (
    <div className="fieldrow">
      <div className="field field--half">
        <input
          placeholder="0"
          value={size}
          inputMode="decimal"
          onChange={(e) => {
            setSize(e.target.value);
            setPct(0);
            setUsdDraft(null);
          }}
        />
        <span className="field__unit">{coin}</span>
      </div>
      <div className="field field--half">
        <input
          placeholder="0"
          value={usdDraft ?? (szNum > 0 ? usdValue : '')}
          inputMode="decimal"
          // No reference price (an unpriced limit order) means USD cannot be
          // converted to a size — fall back to entering the coin amount.
          disabled={pxRef <= 0}
          title={pxRef <= 0 ? 'Enter a limit price first' : undefined}
          onChange={(e) => {
            const v = e.target.value;
            setUsdDraft(v);
            setPct(0);
            const usd = Number(v) || 0;
            setSize(usd > 0 && pxRef > 0 ? (usd / pxRef).toFixed(szDecimals) : '');
          }}
          // Hand control back to the coin size, which is the rounded truth —
          // 100 USDC of BTC is not exactly 100 USDC once the size is rounded.
          onBlur={() => setUsdDraft(null)}
        />
        <span className="field__unit">USDC</span>
      </div>
    </div>
  );

  const sliderRow = (
    <div className="slider">
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
          <span className="dim">%</span>
        </div>
      </div>
      <div className="slider__marks">
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
    </div>
  );

  const tpslFields = tpslOn && (type === 'Market' || type === 'Limit') && (
    <div className="fieldrow">
      <div className="field field--half">
        <span className="field__unit">TP</span>
        <input
          placeholder="—"
          value={tpPx}
          inputMode="decimal"
          onChange={(e) => setTpPx(e.target.value)}
          style={{ textAlign: 'right' }}
        />
      </div>
      <div className="field field--half">
        <span className="field__unit">SL</span>
        <input
          placeholder="—"
          value={slPx}
          inputMode="decimal"
          onChange={(e) => setSlPx(e.target.value)}
          style={{ textAlign: 'right' }}
        />
      </div>
    </div>
  );

  const checkRow = (
    <div className="ticket__opts">
      {type === 'TWAP' ? (
        <>
          <label className="check">
            <input
              type="checkbox"
              checked={twapReduce}
              onChange={(e) => setTwapReduce(e.target.checked)}
            />
            Reduce
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={twapRandom}
              onChange={(e) => setTwapRandom(e.target.checked)}
            />
            Randomize
          </label>
        </>
      ) : (
        <>
          <label className="check">
            <input
              type="checkbox"
              checked={reduceOnly}
              onChange={(e) => setReduceOnly(e.target.checked)}
            />
            Reduce
          </label>
          {(type === 'Market' || type === 'Limit') && (
            <label className="check">
              <input
                type="checkbox"
                checked={tpslOn}
                onChange={(e) => setTpslOn(e.target.checked)}
              />
              TP/SL
            </label>
          )}
        </>
      )}
      {hasTif && (
        <select className="select" value={tif} onChange={(e) => setTif(e.target.value as Tif)}>
          <option value="Gtc">GTC</option>
          <option value="Ioc">IOC</option>
          <option value="Alo">ALO</option>
        </select>
      )}
    </div>
  );

  const footer = () => {
    if (type === 'Scale')
      return (
        <div className="ticket__foot">
          <div className="kv">
            <span className="dim">Start:</span>
            <span className="num">
              {formatSz(scalePreview.first, szDecimals)} {coin}
            </span>
          </div>
          <div className="kv">
            <span className="dim">End:</span>
            <span className="num">
              {formatSz(scalePreview.last, szDecimals)} {coin}
            </span>
          </div>
          <div className="kv">
            <span className="dim">Order Value:</span>
            <span className="num">{formatUsd(orderValue)}</span>
          </div>
          <div className="kv">
            <span className="dim">Average Price:</span>
            <span className="num">{scalePreview.avg > 0 ? scalePreview.avg.toFixed(dp) : '-'}</span>
          </div>
          <div className="kv">
            <span className="dim">Margin Required:</span>
            <span className="num">{formatUsd(marginReq)}</span>
          </div>
        </div>
      );
    if (type === 'TWAP')
      return (
        <div className="ticket__foot">
          <b style={{ fontSize: 13 }}>TWAP Order Preview</b>
          <div className="kv">
            <span className="dim">Frequency:</span>
            <span className="num">30 seconds</span>
          </div>
          <div className="kv">
            <span className="dim">Runtime:</span>
            <span className="num">
              {twapH > 0 ? `${twapH}h ` : ''}
              {twapM}m
            </span>
          </div>
          <div className="kv">
            <span className="dim">Number of Orders:</span>
            <span className="num">{twapOrders}</span>
          </div>
          <div className="kv">
            <span className="dim">Size per Suborder:</span>
            <span className="num">
              {formatSz(szNum / Math.max(1, twapOrders), szDecimals)} {coin}
            </span>
          </div>
        </div>
      );
    if (type === 'Scalp') return null;
    return (
      <div className="ticket__foot">
        <div className="kv">
          <span className="dim">Est Liq:</span>
          <span className="num">{estLiq > 0 ? formatUsd(estLiq) : '$0'}</span>
        </div>
        <div className="kv">
          <span className="dim">Order Val:</span>
          <span className="num">{formatUsd(orderValue)}</span>
        </div>
        <div className="kv">
          <span className="dim">Margin Req:</span>
          <span className="num">{formatUsd(marginReq)}</span>
        </div>
        {type === 'Market' && (
          <div className="kv">
            <span className="dim">Slippage:</span>
            {slipEdit ? (
              <span className="slipedit num">
                Max{' '}
                <input
                  autoFocus
                  value={maxSlip}
                  inputMode="decimal"
                  onChange={(e) =>
                    setMaxSlip(Math.max(0.1, Math.min(50, Number(e.target.value) || 8)))
                  }
                  onBlur={() => setSlipEdit(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setSlipEdit(false)}
                />
                %
              </span>
            ) : (
              <button className="num slipbtn" title="Click to adjust max slippage" onClick={() => setSlipEdit(true)}>
                {estSlip.toFixed(2)}% / Max {maxSlip}%
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const scalpSide = (isBuy: boolean) => {
    const ticks = isBuy ? ticksL : ticksR;
    const setTicks = isBuy ? setTicksL : setTicksR;
    const hk = isBuy ? hkL : hkR;
    const setHk = isBuy ? setHkL : setHkR;
    const reduce = isBuy ? reduceL : reduceR;
    const setReduce = isBuy ? setReduceL : setReduceR;
    const entry = isBuy ? entryL : entryR;
    return (
      <div className="scalp__col">
        <h4>{isBuy ? 'Long' : 'Short'}</h4>
        <div className="field">
          <span className="field__unit">Ticks</span>
          <input
            value={ticks}
            inputMode="numeric"
            onChange={(e) => setTicks(e.target.value)}
            style={{ textAlign: 'right' }}
          />
        </div>
        <div className="dim scalp__entry num">Entry: {entry > 0 ? entry.toFixed(dp) : '—'}</div>
        <div className="field">
          <span className="field__unit">Hotkey</span>
          <input
            value={hk}
            maxLength={1}
            placeholder="—"
            onChange={(e) => setHk(e.target.value.slice(-1))}
            style={{ textAlign: 'right' }}
          />
        </div>
        <label className="check">
          <input type="checkbox" checked={reduce} onChange={(e) => setReduce(e.target.checked)} />
          Reduce
        </label>
        <button
          className={`ticket__cta ticket__cta--${isBuy ? 'buy' : 'sell'}`}
          disabled={trading.status !== 'ready' || trading.busy || szNum <= 0}
          style={trading.status !== 'ready' || szNum <= 0 ? { opacity: 0.55 } : undefined}
          title={szNum <= 0 ? 'Enter a size' : undefined}
          onClick={() => void scalpFire(isBuy)}
        >
          {isBuy ? 'Buy / Long' : 'Sell / Short'}
        </button>
        <div className="ticket__foot scalp__foot">
          <div className="kv">
            <span className="dim">Est Liq:</span>
            <span className="num">
              {entry > 0 && szNum > 0
                ? formatUsd(isBuy ? entry * (1 - 1 / leverage) : entry * (1 + 1 / leverage))
                : '$0'}
            </span>
          </div>
          <div className="kv">
            <span className="dim">Order Val:</span>
            <span className="num">{formatUsd(entry * szNum)}</span>
          </div>
          <div className="kv">
            <span className="dim">Margin Req:</span>
            <span className="num">{formatUsd((entry * szNum) / Math.max(1, leverage))}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="ticket">
      <div className="ticket__toprow">
        <button
          className="chip"
          title="Margin mode"
          onClick={() => {
            setMarginDraft(marginMode);
            setMarginOpen(true);
          }}
        >
          {marginMode === 'cross' ? 'Cross' : 'Isolated'} ▾
        </button>
        <button
          className="chip"
          onClick={() => {
            setLevDraft(leverage);
            setLevOpen(true);
          }}
        >
          {leverage}x ▾
        </button>
        <div className="typewrap">
          <button
            className={`chip chip--select${typeOpen ? ' chip--open' : ''}`}
            onClick={() => setTypeOpen((v) => !v)}
          >
            <span className="dim">Type</span>
            <span className="chip__val">
              {type} {typeOpen ? '▴' : '▾'}
            </span>
          </button>
          {typeOpen && (
            <div className="typemenu">
              {ORDER_TYPES.map((t) => (
                <button
                  key={t}
                  className={`typemenu__item${t === type ? ' typemenu__item--on' : ''}`}
                  onClick={() => {
                    setType(t);
                    setTypeOpen(false);
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {type !== 'Scalp' && (
        <div className="sideswitch">
          <button
            className={`sideswitch__btn sideswitch__btn--buy${side === 'buy' ? ' sideswitch__btn--on' : ''}`}
            onClick={() => setSide('buy')}
          >
            Buy / Long
          </button>
          <button
            className={`sideswitch__btn sideswitch__btn--sell${side === 'sell' ? ' sideswitch__btn--on' : ''}`}
            onClick={() => setSide('sell')}
          >
            Sell / Short
          </button>
        </div>
      )}

      <div className="kv">
        <span className="dim">Available Funds</span>
        <span className="num">{availableUsdc.toFixed(2)} USDC</span>
      </div>
      <div className="kv">
        <span className="dim">Current Position</span>
        <span className={`num${positionSz > 0 ? ' up' : positionSz < 0 ? ' down' : ''}`}>
          {formatSz(positionSz, szDecimals)} {coin}
        </span>
      </div>

      {isStop && priceField('Stop Price', trigger, setTrigger)}
      {type === 'Limit' && priceField('Price', price, setPrice)}
      {type === 'Stop Limit' && priceField('Limit Price', price, setPrice)}

      {sizeRow}
      {sliderRow}

      {type === 'Scale' && (
        <>
          {priceField('Start Price', startPx, setStartPx)}
          {priceField('End Price', endPx, setEndPx)}
          <div className="fieldrow">
            <div className="field field--half">
              <span className="field__unit">Total Orders</span>
              <input
                value={scaleCount}
                inputMode="numeric"
                onChange={(e) => setScaleCount(e.target.value)}
                style={{ textAlign: 'right' }}
              />
            </div>
            <div className="field field--half">
              <span className="field__unit">Size Skew</span>
              <input
                value={scaleSkew}
                inputMode="decimal"
                onChange={(e) => setScaleSkew(e.target.value)}
                style={{ textAlign: 'right' }}
              />
            </div>
          </div>
        </>
      )}

      {type === 'TWAP' && (
        <>
          <div className="dim" style={{ margin: '10px 0 2px', fontWeight: 600 }}>
            Running Time (5m - 24h)
          </div>
          <div className="fieldrow">
            <Stepper label="Hour(s)" value={twapH} onChange={setTwapH} min={0} max={24} />
            <Stepper label="Minute(s)" value={twapM} onChange={setTwapM} min={0} max={59} />
          </div>
        </>
      )}

      {type === 'Scalp' ? (
        <>
          <div className="scalp">
            {scalpSide(true)}
            {scalpSide(false)}
          </div>
          {gateCta()}
        </>
      ) : (
        <>
          {checkRow}
          {tpslFields}
          {placeCta()}
        </>
      )}

      {footer()}

      {levOpen && (
        <div className="modal-backdrop" onClick={() => setLevOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>Adjust Leverage</h3>
              <button className="modal__close" onClick={() => setLevOpen(false)}>
                ✕
              </button>
            </div>
            <p className="modal__note dim">
              Control the leverage used for {coin}-USDC positions. The maximum leverage is {maxLev}
              x.
            </p>
            <p className="modal__note dim">Max position size decreases the higher your leverage.</p>
            <div className="lmodal__row">
              <input
                className="lmodal__slider"
                type="range"
                min={1}
                max={maxLev}
                value={levDraft}
                style={
                  { '--fill': `${((levDraft - 1) / (maxLev - 1)) * 100}%` } as React.CSSProperties
                }
                onChange={(e) => setLevDraft(Number(e.target.value))}
              />
              <span className="lmodal__value num">{levDraft} x</span>
            </div>
            <button
              className="ticket__cta ticket__cta--connect"
              onClick={() => {
                setLeverageLocal(levDraft);
                setLevOpen(false);
                if (trading.status === 'ready' && market)
                  void trading.setLeverage(market.index, levDraft, marginMode === 'cross');
              }}
            >
              Confirm
            </button>
            <div className="lmodal__warn">⚠ Higher leverage increases the risk of liquidation.</div>
          </div>
        </div>
      )}

      {marginOpen && (
        <div className="modal-backdrop" onClick={() => setMarginOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>{coin}-USDC Margin Mode</h3>
              <button className="modal__close" onClick={() => setMarginOpen(false)}>
                ✕
              </button>
            </div>
            <button
              className={`mmode${marginDraft === 'cross' ? ' mmode--on' : ''}`}
              onClick={() => setMarginDraft('cross')}
            >
              <b>Cross</b>
              <span className="dim">
                All cross positions share the same margin. Your entire cross balance backs them —
                higher capital efficiency, shared liquidation risk.
              </span>
            </button>
            <button
              className={`mmode${marginDraft === 'isolated' ? ' mmode--on' : ''}`}
              onClick={() => setMarginDraft('isolated')}
            >
              <b>Isolated</b>
              <span className="dim">
                Margin is dedicated to this position only. Risk is capped to the allocated margin;
                manage it per position.
              </span>
            </button>
            <button
              className="ticket__cta ticket__cta--connect"
              onClick={() => {
                setMarginMode(marginDraft);
                setMarginOpen(false);
                if (trading.status === 'ready' && market)
                  void trading.setLeverage(market.index, leverage, marginDraft === 'cross');
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
