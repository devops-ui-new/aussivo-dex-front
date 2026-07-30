import { useEffect, useState } from 'react';
import { formatPx, formatSz, formatUsd } from '../lib/format';
import { hlSocket } from '../lib/ws';
import { useHlAccount } from '../state/account';
import { useMarket } from '../state/market';
import { useTrading } from '../state/trading';
import { FundingModal, type FundingTab } from './FundingModal';
import { ClosePositionModalFor } from './ClosePositionModal';
import { fundingFields, type AssetPosition, type FundingEntry, type HistoricalOrder } from '../lib/types';

const TABS = [
  'Positions',
  'Open Orders',
  'Trade History',
  'Funding History',
  'Order History',
  'Balances',
] as const;

type Tab = (typeof TABS)[number];


function useSzDecimals() {
  const { markets } = useMarket();
  return (coin: string) => markets.get(coin)?.meta.szDecimals ?? 4;
}

function BalancesTable({
  hideSmall,
  onTransfer,
}: {
  hideSmall: boolean;
  onTransfer: () => void;
}) {
  const { clearinghouse, spotBalances } = useHlAccount();
  const perpTotal = Number(clearinghouse?.marginSummary.accountValue ?? 0);
  const perpAvail = Number(clearinghouse?.withdrawable ?? 0);

  const transfer = (
    <button
      className="btn-soft"
      style={{ padding: '3px 10px' }}
      title="Transfer between Spot and Perps"
      onClick={() => onTransfer()}
    >
      ⇆
    </button>
  );

  // Perps margin and spot holdings are separate balance sheets — show both, or a
  // deposit that landed in Spot looks like it vanished.
  const rows = [
    { account: 'Perps', coin: 'USDC', total: perpTotal, avail: perpAvail, usd: perpTotal },
    ...spotBalances.map((b) => {
      const total = Number(b.total);
      return {
        account: 'Spot',
        coin: b.coin,
        total,
        avail: total - Number(b.hold),
        // Only USDC is reliably 1:1; others would need spot mids to value.
        usd: b.coin === 'USDC' ? total : null,
      };
    }),
  ].filter((r) => r.total > 0 || r.account === 'Perps');

  const shown = hideSmall ? rows.filter((r) => (r.usd ?? 0) >= 1) : rows;
  if (shown.length === 0) return <div className="empty">No balances above $1</div>;

  return (
    <table className="ptable">
      <thead>
        <tr>
          <th>Account</th>
          <th>Coin</th>
          <th>Total Balance</th>
          <th>Available Balance</th>
          <th>USD Value</th>
          <th>Transfer</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((r) => (
          <tr key={`${r.account}-${r.coin}`}>
            <td className="dim">{r.account}</td>
            <td>{r.coin}</td>
            <td className="num">{r.total.toFixed(r.coin === 'USDC' ? 2 : 6)}</td>
            <td className="num">{r.avail.toFixed(r.coin === 'USDC' ? 2 : 6)}</td>
            <td className="num">{r.usd === null ? '—' : `${r.usd.toFixed(2)} USD`}</td>
            <td>{transfer}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PositionsTable() {
  const { positions } = useHlAccount();
  const szDec = useSzDecimals();
  const { markets } = useMarket();
  const trading = useTrading();
  const [closing, setClosing] = useState<AssetPosition | null>(null);

  if (positions.length === 0) return <div className="empty">No open positions</div>;
  return (
    <>
      <table className="ptable">
      <thead>
        <tr>
          <th>Coin</th>
          <th>Size</th>
          <th>Position Value</th>
          <th>Entry Price</th>
          <th>Mark Price</th>
          <th>Liq. Price</th>
          <th>Margin</th>
          <th>uPNL (ROE %)</th>
          <th>Close</th>
        </tr>
      </thead>
      <tbody>
        {positions.map(({ position: p }) => {
          const szi = Number(p.szi);
          const upnl = Number(p.unrealizedPnl);
          const roe = Number(p.returnOnEquity);
          const market = markets.get(p.coin);
          const mark = Number(market?.ctx.markPx ?? 0);
          const dec = szDec(p.coin);
          const canTrade = trading.status === 'ready' && market;
          return (
            <tr key={p.coin}>
              <td>
                <b>{p.coin}</b>{' '}
                <span className={szi > 0 ? 'up' : 'down'}>{szi > 0 ? 'Long' : 'Short'}</span>{' '}
                <span className="dim">
                  {p.leverage.value}x {p.leverage.type === 'isolated' ? 'iso' : ''}
                </span>
              </td>
              <td className={`num ${szi > 0 ? 'up' : 'down'}`}>{formatSz(szi, dec)}</td>
              <td className="num">{formatUsd(Number(p.positionValue))}</td>
              <td className="num">{p.entryPx ? formatPx(Number(p.entryPx), dec) : '-'}</td>
              <td className="num">{mark > 0 ? formatPx(mark, dec) : '-'}</td>
              {/* Hyperliquid returns null when the computed liquidation price is
                  unreachable (<= 0) — i.e. account equity fully covers the position.
                  A bare dash reads as missing data, so say what it means. */}
              <td className="num">
                {p.liquidationPx ? (
                  formatPx(Number(p.liquidationPx), dec)
                ) : (
                  <span
                    className="up"
                    title="No liquidation price: your account equity fully covers this position, so it cannot be liquidated at any price above zero."
                  >
                    None
                  </span>
                )}
              </td>
              <td className="num">{formatUsd(Number(p.marginUsed))}</td>
              <td className={`num ${upnl >= 0 ? 'up' : 'down'}`}>
                {upnl >= 0 ? '+' : '-'}
                {formatUsd(Math.abs(upnl))} ({(roe * 100).toFixed(2)}%)
              </td>
              <td>
                {canTrade ? (
                  <button
                    className="btn-soft"
                    style={{ padding: '3px 12px' }}
                    title="Choose how much to close"
                    onClick={() => setClosing(positions.find((x) => x.position.coin === p.coin)!)}
                  >
                    Close
                  </button>
                ) : trading.status === 'locked' ? (
                  <button
                    className="btn-soft"
                    style={{ padding: '3px 10px' }}
                    title="One signature to unlock popup-free trading"
                    onClick={() => void trading.unlock()}
                  >
                    Unlock
                  </button>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
      </table>
      {closing && (
        <ClosePositionModalFor position={closing} onClose={() => setClosing(null)} />
      )}
    </>
  );
}

function OpenOrdersTable() {
  const { openOrders } = useHlAccount();
  const szDec = useSzDecimals();
  const { markets } = useMarket();
  const trading = useTrading();

  if (openOrders.length === 0) return <div className="empty">No open orders</div>;
  return (
    <table className="ptable">
      <thead>
        <tr>
          <th>Time</th>
          <th>Coin</th>
          <th>Side</th>
          <th>Size</th>
          <th>Price</th>
          <th>Type</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {openOrders.map((o) => {
          const assetIndex = markets.get(o.coin)?.index;
          return (
            <tr key={o.oid}>
              <td className="num dim">{new Date(o.timestamp).toLocaleString('en-GB')}</td>
              <td>
                <b>{o.coin}</b>
              </td>
              <td className={o.side === 'B' ? 'up' : 'down'}>{o.side === 'B' ? 'Buy' : 'Sell'}</td>
              <td className="num">{formatSz(Number(o.sz), szDec(o.coin))}</td>
              <td className="num">{formatPx(Number(o.limitPx), szDec(o.coin))}</td>
              <td className="dim">
                {o.orderType ?? 'Limit'}
                {o.reduceOnly ? ' · RO' : ''}
              </td>
              <td>
                {trading.status === 'ready' && assetIndex !== undefined && (
                  <button
                    className="btn-soft"
                    style={{ padding: '3px 10px' }}
                    onClick={() => void trading.cancelOrder(assetIndex, o.oid)}
                  >
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FillsTable() {
  const { fills } = useHlAccount();
  const szDec = useSzDecimals();

  if (fills.length === 0) return <div className="empty">No fills yet</div>;
  return (
    <table className="ptable">
      <thead>
        <tr>
          <th>Time</th>
          <th>Coin</th>
          <th>Direction</th>
          <th>Size</th>
          <th>Price</th>
          <th>Fee</th>
          <th>Closed PNL</th>
        </tr>
      </thead>
      <tbody>
        {fills.slice(0, 100).map((f) => {
          const pnl = Number(f.closedPnl);
          return (
            <tr key={`${f.oid}-${f.time}-${f.px}`}>
              <td className="num dim">{new Date(f.time).toLocaleString('en-GB')}</td>
              <td>
                <b>{f.coin}</b>
              </td>
              <td className={f.side === 'B' ? 'up' : 'down'}>{f.dir}</td>
              <td className="num">{formatSz(Number(f.sz), szDec(f.coin))}</td>
              <td className="num">{formatPx(Number(f.px), szDec(f.coin))}</td>
              <td className="num dim">
                {Number(f.fee).toFixed(4)} {f.feeToken}
              </td>
              <td className={`num ${pnl >= 0 ? 'up' : 'down'}`}>
                {pnl >= 0 ? '+' : '-'}
                {formatUsd(Math.abs(pnl))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FundingTable() {
  const { address } = useHlAccount();
  const [rows, setRows] = useState<FundingEntry[] | null>(null);

  useEffect(() => {
    if (!address) return;
    return hlSocket.subscribe({ type: 'userFundings', user: address }, (d) => {
      const p = d as { isSnapshot?: boolean; fundings?: FundingEntry[] };
      const incoming = (p.fundings ?? []).slice().reverse();
      setRows((prev) => (p.isSnapshot || !prev ? incoming : [...incoming, ...prev]));
    });
  }, [address]);

  if (rows === null) return <div className="empty">Loading…</div>;
  if (rows.length === 0) return <div className="empty">No funding payments in the last 14 days</div>;
  return (
    <table className="ptable">
      <thead>
        <tr>
          <th>Time</th>
          <th>Coin</th>
          <th>Payment</th>
          <th>Rate</th>
          <th>Position Size</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 100).map((r, i) => {
          // WS rows carry the fields flat and have no hash; REST rows nest them
          // under `delta`. Reading either shape directly threw on the other.
          const d = fundingFields(r);
          const usdc = Number(d.usdc);
          return (
            <tr key={`${r.hash ?? d.coin}-${r.time}-${i}`}>
              <td className="num dim">{new Date(r.time).toLocaleString('en-GB')}</td>
              <td>
                <b>{d.coin}</b>
              </td>
              <td className={`num ${usdc >= 0 ? 'up' : 'down'}`}>
                {usdc >= 0 ? '+' : '-'}${Math.abs(usdc).toFixed(4)}
              </td>
              <td className="num dim">{(Number(d.fundingRate) * 100).toFixed(4)}%</td>
              <td className="num">{d.szi}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function OrderHistoryTable() {
  const { address } = useHlAccount();
  const szDec = useSzDecimals();
  const [rows, setRows] = useState<HistoricalOrder[] | null>(null);

  useEffect(() => {
    if (!address) return;
    return hlSocket.subscribe({ type: 'userHistoricalOrders', user: address }, (d) => {
      const p = d as { isSnapshot?: boolean; orderHistory?: HistoricalOrder[] };
      const incoming = p.orderHistory ?? [];
      setRows((prev) => (p.isSnapshot || !prev ? incoming : [...incoming, ...prev]));
    });
  }, [address]);

  if (rows === null) return <div className="empty">Loading…</div>;
  if (rows.length === 0) return <div className="empty">No orders yet</div>;
  return (
    <table className="ptable">
      <thead>
        <tr>
          <th>Time</th>
          <th>Coin</th>
          <th>Side</th>
          <th>Size</th>
          <th>Price</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 100).map(({ order: o, status, statusTimestamp }) => (
          <tr key={`${o.oid}-${statusTimestamp}`}>
            <td className="num dim">{new Date(statusTimestamp).toLocaleString('en-GB')}</td>
            <td>
              <b>{o.coin}</b>
            </td>
            <td className={o.side === 'B' ? 'up' : 'down'}>{o.side === 'B' ? 'Buy' : 'Sell'}</td>
            <td className="num">{formatSz(Number(o.origSz), szDec(o.coin))}</td>
            <td className="num">{formatPx(Number(o.limitPx), szDec(o.coin))}</td>
            <td
              className={
                status === 'filled' ? 'up' : status === 'canceled' ? 'dim' : status === 'rejected' ? 'down' : ''
              }
            >
              {status}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BottomPanel() {
  const [funding, setFunding] = useState<FundingTab | null>(null);
  const [tab, setTab] = useState<Tab>('Positions');
  const [hideSmall, setHideSmall] = useState(true);
  const { address, positions, openOrders } = useHlAccount();
  const { markets } = useMarket();
  const trading = useTrading();

  const counted: Partial<Record<Tab, number>> = {
    Positions: positions.length,
    'Open Orders': openOrders.length,
  };

  const cancels = openOrders
    .map((o) => ({ a: markets.get(o.coin)?.index, o: o.oid }))
    .filter((c): c is { a: number; o: number } => c.a !== undefined);

  const body = () => {
    if (!address) return <div className="empty">Connect a wallet to see {tab.toLowerCase()}</div>;
    switch (tab) {
      case 'Balances':
        return <BalancesTable hideSmall={hideSmall} onTransfer={() => setFunding('transfer')} />;
      case 'Positions':
        return <PositionsTable />;
      case 'Open Orders':
        return <OpenOrdersTable />;
      case 'Trade History':
        return <FillsTable />;
      case 'Funding History':
        return <FundingTable />;
      case 'Order History':
        return <OrderHistoryTable />;
    }
  };

  return (
    <div className="bottom">
      <div className="bottom__tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`bottom__tab${t === tab ? ' bottom__tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
            {counted[t] !== undefined ? `(${counted[t]})` : ''}
          </button>
        ))}
        <span className="bottom__spacer" />
        {tab === 'Open Orders' && trading.status === 'ready' && cancels.length > 0 && (
          <button className="btn-soft" style={{ padding: '4px 12px', marginRight: 10 }} onClick={() => void trading.cancelAll(cancels)}>
            Cancel All
          </button>
        )}
        {tab === 'Balances' && (
          <label className="check dim" style={{ fontSize: 12 }}>
            <input
              type="checkbox"
              checked={hideSmall}
              onChange={(e) => setHideSmall(e.target.checked)}
            />{' '}
            Hide Small Balances
          </label>
        )}
      </div>
      <div className="bottom__body">{body()}</div>
      {funding && <FundingModal tab={funding} onClose={() => setFunding(null)} />}
    </div>
  );
}
