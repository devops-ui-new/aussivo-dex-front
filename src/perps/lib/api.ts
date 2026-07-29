import { HL_API_URL } from '../config';
import { hlSocket } from './ws';
import type {
  Candle,
  CandleInterval,
  ClearinghouseState,
  FundingEntry,
  HistoricalOrder,
  MetaAndAssetCtxs,
  OpenOrder,
  SpotState,
  UserFill,
} from './types';

/** Hard ceiling per request — without one, a stalled fetch hangs the UI forever. */
const INFO_TIMEOUT_MS = 15_000;

/**
 * Identical in-flight requests share one promise. React StrictMode double-invokes
 * effects in dev, and several components ask for the same snapshot on mount, so
 * without this the app fires the same POST 2-6 times concurrently on every load.
 */
const inflight = new Map<string, Promise<unknown>>();

async function post<T>(key: string, body: Record<string, unknown>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), INFO_TIMEOUT_MS);
  try {
    const res = await fetch(`${HL_API_URL}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HL info ${body.type}: HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`HL info ${body.type}: timed out after ${INFO_TIMEOUT_MS / 1000}s`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
    inflight.delete(key);
  }
}

/**
 * One-shot reads go over the existing WebSocket (`method: "post"`) so the app
 * holds a single connection instead of opening an HTTP request per call. Falls
 * back to POST /info if the socket is unavailable or the frame errors.
 */
function info<T>(body: Record<string, unknown>): Promise<T> {
  const key = JSON.stringify(body);
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const p = hlSocket
    .post<T>(body)
    .catch(() => post<T>(key, body))
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function fetchMetaAndAssetCtxs(): Promise<MetaAndAssetCtxs> {
  return info<MetaAndAssetCtxs>({ type: 'metaAndAssetCtxs' });
}

export function fetchCandles(
  coin: string,
  interval: CandleInterval,
  startTime: number,
  endTime: number,
): Promise<Candle[]> {
  return info<Candle[]>({ type: 'candleSnapshot', req: { coin, interval, startTime, endTime } });
}

export function fetchClearinghouseState(user: string): Promise<ClearinghouseState> {
  return info<ClearinghouseState>({ type: 'clearinghouseState', user });
}

/** Spot holdings. Separate from the perps clearinghouse — bridge deposits arrive here. */
export function fetchSpotState(user: string): Promise<SpotState> {
  return info<SpotState>({ type: 'spotClearinghouseState', user });
}

/**
 * Account mode: "default" keeps Spot and Perps as separate balance sheets,
 * "unifiedAccount" merges them (and disables usdClassTransfer entirely),
 * "portfolioMargin" is cross-margin across the whole portfolio.
 */
export function fetchUserAbstraction(user: string): Promise<string> {
  return info<string>({ type: 'userAbstraction', user });
}

export function fetchOpenOrders(user: string): Promise<OpenOrder[]> {
  return info<OpenOrder[]>({ type: 'frontendOpenOrders', user });
}

export function fetchUserFills(user: string): Promise<UserFill[]> {
  return info<UserFill[]>({ type: 'userFills', user });
}

/** Approved builder fee for (user, builder) in tenths of a basis point; 0 if unapproved. */
export function fetchMaxBuilderFee(user: string, builder: string): Promise<number> {
  return info<number>({ type: 'maxBuilderFee', user, builder });
}

export function fetchHistoricalOrders(user: string): Promise<HistoricalOrder[]> {
  return info<HistoricalOrder[]>({ type: 'historicalOrders', user });
}

export function fetchUserFunding(user: string, startTime: number): Promise<FundingEntry[]> {
  return info<FundingEntry[]>({ type: 'userFunding', user, startTime });
}
