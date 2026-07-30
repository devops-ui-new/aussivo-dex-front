import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_COIN } from '../config';
import { fetchMetaAndAssetCtxs } from '../lib/api';
import { hlSocket } from '../lib/ws';
import type { AllMids, AssetCtx, PerpAssetMeta } from '../lib/types';

export interface MarketInfo {
  meta: PerpAssetMeta;
  ctx: AssetCtx;
  /** Asset index in the perp universe — the `a` field of order actions. */
  index: number;
}

interface MarketState {
  coin: string;
  setCoin: (coin: string) => void;
  markets: Map<string, MarketInfo>;
  mids: Record<string, string>;
  /** Selected market, once loaded. */
  market: MarketInfo | null;
  favorites: string[];
  toggleFavorite: (coin: string) => void;
}

const MarketContext = createContext<MarketState | null>(null);

/** The universe (names, szDecimals, maxLeverage) only changes on listings, so it
 *  is fetched once and refreshed rarely; live prices come over the socket. */
const UNIVERSE_REFRESH_MS = 10 * 60_000;
const FAV_KEY = 'builderfi.favorites';

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    // fall through to defaults
  }
  return ['BTC', 'ETH', 'HYPE'];
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [coin, setCoin] = useState(DEFAULT_COIN);
  const [markets, setMarkets] = useState<Map<string, MarketInfo>>(new Map());
  const [mids, setMids] = useState<Record<string, string>>({});
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const alive = useRef(true);

  const toggleFavorite = useCallback((c: string) => {
    setFavorites((prev) => {
      const next = prev.includes(c) ? prev.filter((f) => f !== c) : [...prev, c];
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable — favorites just won't persist
      }
      return next;
    });
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const [meta, ctxs] = await fetchMetaAndAssetCtxs();
      if (!alive.current) return false;
      const next = new Map<string, MarketInfo>();
      meta.universe.forEach((m, i) => {
        const ctx = ctxs[i];
        if (ctx) next.set(m.name, { meta: m, ctx, index: i });
      });
      setMarkets(next);
      return true;
    } catch {
      return false;
    }
  }, []);

  /** Retry the first load quickly — nothing renders until the universe arrives,
   *  and waiting a full refresh interval leaves the app stuck on "Loading markets…". */
  const loadWithRetry = useCallback(async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (await refresh()) return;
      if (!alive.current) return;
      await new Promise((r) => setTimeout(r, Math.min(8000, 1000 * 2 ** attempt)));
    }
  }, [refresh]);

  useEffect(() => {
    alive.current = true;
    void loadWithRetry();
    const t = setInterval(() => void refresh(), UNIVERSE_REFRESH_MS);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [refresh, loadWithRetry]);

  useEffect(
    () => hlSocket.subscribe({ type: 'allMids' }, (data) => setMids((data as AllMids).mids ?? {})),
    [],
  );

  // Live mark/funding/OI/volume, keyed by the universe index from the one-time
  // fetch. Replaces re-POSTing the whole 232-market metaAndAssetCtxs payload.
  useEffect(
    () =>
      hlSocket.subscribe({ type: 'assetCtxs' }, (data) => {
        const ctxs = (data as { ctxs?: AssetCtx[] }).ctxs;
        if (!ctxs?.length) return;
        setMarkets((prev) => {
          if (prev.size === 0) return prev; // universe not loaded yet
          const next = new Map(prev);
          for (const [name, info] of prev) {
            const ctx = ctxs[info.index];
            if (ctx) next.set(name, { ...info, ctx });
          }
          return next;
        });
      }),
    [],
  );

  const value = useMemo<MarketState>(
    () => ({
      coin,
      setCoin,
      markets,
      mids,
      market: markets.get(coin) ?? null,
      favorites,
      toggleFavorite,
    }),
    [coin, markets, mids, favorites, toggleFavorite],
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketState {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket outside MarketProvider');
  return ctx;
}

/** Live mid price for a coin as a number, falling back to markPx. */
export function useMid(coin: string): number {
  const { mids, markets } = useMarket();
  const mid = mids[coin] ?? markets.get(coin)?.ctx.midPx ?? markets.get(coin)?.ctx.markPx;
  return mid ? Number(mid) : 0;
}
