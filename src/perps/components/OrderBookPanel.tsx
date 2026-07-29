import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPx, formatSz } from '../lib/format';
import { hlSocket } from '../lib/ws';
import { useMarket, useMid } from '../state/market';
import type { BookLevel, L2Book, Trade } from '../lib/types';

const SPLIT_ROWS = 12;
const SOLO_ROWS = 24;
const MAX_TRADES = 60;

type ViewMode = 'split' | 'bids' | 'asks';
type Units = 'coin' | 'usd';

interface Row {
  px: number;
  sz: number;
  cum: number;
}

function toRows(levels: BookLevel[] | undefined, count: number): Row[] {
  let cum = 0;
  return (levels ?? []).slice(0, count).map((l) => {
    cum += Number(l.sz);
    return { px: Number(l.px), sz: Number(l.sz), cum };
  });
}

function fmtUsd(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: v >= 100 ? 0 : 2 });
}

/** Tick sizes 1/10/100/1000 × base map exactly onto HL's nSigFigs 5/4/3/2. */
function tickLabel(mid: number, sigFigs: number): string {
  if (mid <= 0) return '1';
  const exp = Math.floor(Math.log10(mid));
  const tick = 10 ** (exp - sigFigs + 1);
  return tick >= 1 ? String(tick) : tick.toFixed(Math.max(0, -Math.floor(Math.log10(tick))));
}

function OrderBook({ onPricePick }: { onPricePick: (px: number) => void }) {
  const { coin, market } = useMarket();
  const mid = useMid(coin);
  const szDecimals = market?.meta.szDecimals ?? 3;
  const [book, setBook] = useState<L2Book | null>(null);
  const [view, setView] = useState<ViewMode>('split');
  const [units, setUnits] = useState<Units>('coin');
  const [sigFigs, setSigFigs] = useState(5);
  // Flash rows whose size changed (not on the first snapshot per coin).
  const prevSizes = useRef<Map<number, number>>(new Map());
  const seededCoin = useRef('');

  useEffect(() => {
    setBook(null);
    prevSizes.current = new Map();
    seededCoin.current = '';
    return hlSocket.subscribe({ type: 'l2Book', coin, nSigFigs: sigFigs }, (data) =>
      setBook(data as L2Book),
    );
  }, [coin, sigFigs]);

  const rowCount = view === 'split' ? SPLIT_ROWS : SOLO_ROWS;
  const bids = useMemo(() => toRows(book?.levels[0], rowCount), [book, rowCount]);
  const asks = useMemo(() => toRows(book?.levels[1], rowCount), [book, rowCount]);
  const maxCum = Math.max(bids.at(-1)?.cum ?? 0, asks.at(-1)?.cum ?? 0, 1e-12);

  const flashSet = useMemo(() => {
    const flashes = new Set<number>();
    const next = new Map<number, number>();
    for (const r of [...bids, ...asks]) {
      next.set(r.px, r.sz);
      if (seededCoin.current === coin && prevSizes.current.has(r.px)) {
        if (prevSizes.current.get(r.px) !== r.sz) flashes.add(r.px);
      }
    }
    prevSizes.current = next;
    seededCoin.current = coin;
    return flashes;
  }, [bids, asks, coin]);

  const bestBid = bids[0]?.px ?? 0;
  const bestAsk = asks[0]?.px ?? 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
  const spreadPct = bestAsk > 0 ? spread / bestAsk : 0;

  const val = (r: Row, cumulative: boolean) => {
    const v = cumulative ? r.cum : r.sz;
    return units === 'usd' ? fmtUsd(v * r.px) : formatSz(v, szDecimals);
  };

  const renderRow = (r: Row, side: 'bid' | 'ask') => (
    <div
      key={r.px}
      className={`book__row${flashSet.has(r.px) ? ` book__row--flash-${side}` : ''}`}
      onClick={() => onPricePick(r.px)}
    >
      <span
        className={`book__depth book__depth--${side}`}
        style={{ width: `${(r.cum / maxCum) * 100}%` }}
      />
      <span className={`num ${side === 'ask' ? 'down' : 'up'}`}>{formatPx(r.px, szDecimals)}</span>
      <span className="num">{val(r, false)}</span>
      <span className="num dim">{val(r, true)}</span>
    </div>
  );

  const spreadRow = (
    <div className="book__spread">
      <span>Spread</span>
      <span className="num" style={{ textAlign: 'right' }}>
        {formatPx(spread, szDecimals)}
      </span>
      <span className="num" style={{ textAlign: 'right' }}>
        {(spreadPct * 100).toFixed(2)}%
      </span>
    </div>
  );

  const unitLabel = units === 'usd' ? 'USD' : coin;

  return (
    <>
      <div className="book__cols">
        <span>Price</span>
        <span>Amount ({unitLabel})</span>
        <span>Total ({unitLabel})</span>
      </div>
      <div className="book__rows">
        {view !== 'bids' && (
          <div
            className="book__side"
            style={{ justifyContent: view === 'asks' ? 'flex-end' : 'flex-end' }}
          >
            {[...asks].reverse().map((r) => renderRow(r, 'ask'))}
          </div>
        )}
        {view !== 'asks' && view !== 'bids' && spreadRow}
        {view === 'bids' && spreadRow}
        {view !== 'asks' && (
          <div className="book__side book__side--bids">{bids.map((r) => renderRow(r, 'bid'))}</div>
        )}
        {view === 'asks' && spreadRow}
      </div>
      <div className="book__footer">
        <div className="book__views">
          <button
            className={`bookview${view === 'split' ? ' bookview--on' : ''}`}
            title="Book: bids and asks"
            onClick={() => setView('split')}
          >
            <span className="swatch" style={{ background: 'var(--red)' }} />
            <span className="swatch" style={{ background: 'var(--green)' }} />
          </button>
          <button
            className={`bookview${view === 'bids' ? ' bookview--on' : ''}`}
            title="Bids only"
            onClick={() => setView('bids')}
          >
            <span className="swatch" style={{ background: 'var(--green)' }} />
          </button>
          <button
            className={`bookview${view === 'asks' ? ' bookview--on' : ''}`}
            title="Asks only"
            onClick={() => setView('asks')}
          >
            <span className="swatch" style={{ background: 'var(--red)' }} />
          </button>
        </div>
        <span style={{ flex: 1 }} />
        <select
          className="select"
          title="Units"
          value={units}
          onChange={(e) => setUnits(e.target.value as Units)}
        >
          <option value="coin">{coin}</option>
          <option value="usd">USD</option>
        </select>
        <select
          className="select"
          title="Price grouping"
          value={sigFigs}
          onChange={(e) => setSigFigs(Number(e.target.value))}
        >
          {[5, 4, 3, 2].map((n) => (
            <option key={n} value={n}>
              {tickLabel(mid, n)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function TradesFeed() {
  const { coin, market } = useMarket();
  const szDecimals = market?.meta.szDecimals ?? 3;
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    setTrades([]);
    return hlSocket.subscribe({ type: 'trades', coin }, (data) => {
      const incoming = (data as Trade[]).filter((t) => t.coin === coin);
      setTrades((prev) => [...incoming.reverse(), ...prev].slice(0, MAX_TRADES));
    });
  }, [coin]);

  return (
    <>
      <div className="book__cols">
        <span>Price</span>
        <span>Amount ({coin})</span>
        <span>Time</span>
      </div>
      <div className="trades">
        {trades.map((t) => (
          <div key={t.hash + t.time + t.px} className="book__row">
            <span className={`num ${t.side === 'B' ? 'up' : 'down'}`}>
              {formatPx(Number(t.px), szDecimals)}
            </span>
            <span className="num">{formatSz(Number(t.sz), szDecimals)}</span>
            <span className="num dim">
              {new Date(t.time).toLocaleTimeString('en-US', { hour12: true })}
            </span>
          </div>
        ))}
        {trades.length === 0 && <div className="empty">Waiting for trades…</div>}
      </div>
    </>
  );
}

export function OrderBookPanel({ onPricePick }: { onPricePick: (px: number) => void }) {
  const [tab, setTab] = useState<'book' | 'trades'>('book');
  return (
    <div className="book">
      <div className="panel-tabs">
        <button
          className={`panel-tab${tab === 'book' ? ' panel-tab--active' : ''}`}
          onClick={() => setTab('book')}
        >
          Order Book
        </button>
        <button
          className={`panel-tab${tab === 'trades' ? ' panel-tab--active' : ''}`}
          onClick={() => setTab('trades')}
        >
          Trades
        </button>
      </div>
      {tab === 'book' ? <OrderBook onPricePick={onPricePick} /> : <TradesFeed />}
    </div>
  );
}
