import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CATEGORIES, inCategory, type Category } from '../lib/categories';
import { formatPct, formatPx, formatUsd } from '../lib/format';
import { useMarket, type MarketInfo } from '../state/market';
import { usePortalRoot } from '../lib/portalRoot';

type SortKey = 'px' | 'chg' | 'funding' | 'volume' | 'oi';

interface RowData {
  info: MarketInfo;
  px: number;
  chg: number;
  funding: number;
  volume: number;
  oi: number;
  fav: boolean;
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'px', label: 'Last Price' },
  { key: 'chg', label: '24H Change' },
  { key: 'funding', label: '8H Funding' },
  { key: 'volume', label: 'Volume' },
  { key: 'oi', label: 'Open Interest' },
];

/**
 * Full-width market picker panel (based.one style): search, asset-class tabs,
 * sector tabs, sortable table with favorites. Portaled + fixed so no overflow
 * ancestor clips it.
 */
export function MarketPicker({ anchor, onClose }: { anchor: HTMLElement; onClose: () => void }) {
  const { setCoin, markets, mids, favorites, toggleFavorite } = useMarket();
  // Must sit inside `.perp-terminal` or none of the scoped styles apply.
  const portalRoot = usePortalRoot();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('All');
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [sortDesc, setSortDesc] = useState(true);
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number; width: number }>();
  const boxRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const width = Math.min(1040, window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const top = r.bottom + 8;
      // Compact floating panel: cap the height, let the table scroll inside.
      setPos({ top, left, maxH: Math.max(220, Math.min(640, window.innerHeight - top - 16)), width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!boxRef.current?.contains(t) && !anchor.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchor, onClose]);

  const rows = useMemo<RowData[]>(() => {
    const q = query.toUpperCase();
    const list = [...markets.values()]
      .filter((m) => m.meta.name.toUpperCase().includes(q) && inCategory(m.meta.name, category))
      .map((m) => {
        const px = Number(mids[m.meta.name] ?? m.ctx.markPx);
        const prev = Number(m.ctx.prevDayPx);
        return {
          info: m,
          px,
          chg: prev > 0 ? px / prev - 1 : 0,
          funding: Number(m.ctx.funding),
          volume: Number(m.ctx.dayNtlVlm),
          oi: Number(m.ctx.openInterest) * Number(m.ctx.markPx),
          fav: favorites.includes(m.meta.name),
        };
      });
    const dir = sortDesc ? -1 : 1;
    list.sort((a, b) => {
      if (a.fav !== b.fav) return a.fav ? -1 : 1; // favorites pinned on top
      return (a[sortKey] - b[sortKey]) * dir;
    });
    return list;
  }, [markets, mids, query, category, favorites, sortKey, sortDesc]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  if (!pos || !portalRoot) return null;

  return createPortal(
    <div
      ref={boxRef}
      className="mpanel"
      style={{ top: pos.top, left: pos.left, maxHeight: pos.maxH, width: pos.width }}
    >
      <div className="mpanel__searchrow">
        <div className="mpanel__search">
          <span className="mpanel__searchicon">🔍</span>
          <input
            placeholder="Search markets…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="mpanel__tabs">
        <button className="mpanel__tab mpanel__tab--active">Perps</button>
        <button className="mpanel__tab mpanel__tab--disabled" disabled title="Coming soon">
          Spot
        </button>
      </div>

      <div className="mpanel__tabs mpanel__tabs--sub">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`mpanel__tab${c === category ? ' mpanel__tab--active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mpanel__scroll">
        <table className="mpanel__table">
          <thead>
            <tr>
              <th className="mpanel__symhead">Symbol</th>
              {COLUMNS.map((c) => (
                <th key={c.key} onClick={() => onSort(c.key)} className="mpanel__sortable">
                  {c.label}
                  {sortKey === c.key ? (sortDesc ? ' ↓' : ' ↑') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const name = r.info.meta.name;
              return (
                <tr
                  key={name}
                  onClick={() => {
                    setCoin(name);
                    onClose();
                  }}
                >
                  <td className="mpanel__sym">
                    <button
                      className={`mpanel__star${r.fav ? ' mpanel__star--on' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(name);
                      }}
                    >
                      {r.fav ? '★' : '☆'}
                    </button>
                    <b>{name}-USDC</b>
                    <span className="mpanel__lev">{r.info.meta.maxLeverage}X</span>
                  </td>
                  <td className="num">{formatPx(r.px, r.info.meta.szDecimals)}</td>
                  <td className={`num ${r.chg >= 0 ? 'up' : 'down'}`}>{formatPct(r.chg)}</td>
                  {/* HL funding is hourly; display the 8h-equivalent like major venues */}
                  <td className={`num ${r.funding >= 0 ? 'up' : 'down'}`}>
                    {(r.funding * 8 * 100).toFixed(4)}%
                  </td>
                  <td className="num">
                    ${r.volume.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="num">{formatUsd(r.oi)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">No markets match “{query}”</div>}
      </div>
    </div>,
    portalRoot,
  );
}
