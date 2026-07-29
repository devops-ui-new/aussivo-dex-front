// Hyperliquid public API types (only the fields we consume).

export interface PerpAssetMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
}

export interface AssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium: string | null;
  oraclePx: string;
  markPx: string;
  midPx: string | null;
  impactPxs: string[] | null;
}

export interface Meta {
  universe: PerpAssetMeta[];
}

export type MetaAndAssetCtxs = [Meta, AssetCtx[]];

export interface BookLevel {
  px: string;
  sz: string;
  n: number;
}

export interface L2Book {
  coin: string;
  time: number;
  /** [bids, asks], best first */
  levels: [BookLevel[], BookLevel[]];
}

export interface Trade {
  coin: string;
  /** "B" buy / "A" sell (aggressor side) */
  side: 'B' | 'A';
  px: string;
  sz: string;
  time: number;
  hash: string;
}

export interface Candle {
  t: number; // open time ms
  T: number; // close time ms
  s: string; // coin
  i: string; // interval
  o: string;
  c: string;
  h: string;
  l: string;
  v: string; // base volume
  n: number; // trade count
}

export type CandleInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';

export interface AllMids {
  mids: Record<string, string>;
}

/** Spot account holdings — a separate balance sheet from the perps clearinghouse.
 *  Bridge deposits land here and must be transferred to Perps before trading. */
export interface SpotBalance {
  coin: string;
  token: number;
  total: string;
  hold: string;
  entryNtl: string;
}

export interface SpotState {
  balances: SpotBalance[];
}

// ---------- account state (info queries by user address) ----------

export interface PositionLeverage {
  type: 'cross' | 'isolated';
  value: number;
}

export interface AssetPosition {
  type: 'oneWay';
  position: {
    coin: string;
    /** signed size: >0 long, <0 short */
    szi: string;
    entryPx: string | null;
    positionValue: string;
    unrealizedPnl: string;
    returnOnEquity: string;
    liquidationPx: string | null;
    marginUsed: string;
    leverage: PositionLeverage;
    maxLeverage: number;
  };
}

export interface ClearinghouseState {
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  crossMarginSummary: {
    accountValue: string;
    totalMarginUsed: string;
  };
  withdrawable: string;
  assetPositions: AssetPosition[];
  time: number;
}

export interface OpenOrder {
  coin: string;
  side: 'B' | 'A';
  limitPx: string;
  sz: string;
  origSz: string;
  oid: number;
  timestamp: number;
  orderType?: string;
  reduceOnly?: boolean;
}

export interface HistoricalOrder {
  order: OpenOrder & { origSz: string };
  status: string; // "filled" | "canceled" | "rejected" | "open" | ...
  statusTimestamp: number;
}

/** The payload fields, however they arrive. */
export interface FundingDelta {
  type?: 'funding';
  coin: string;
  usdc: string;
  szi: string;
  fundingRate: string;
  nSamples?: number | null;
}

/**
 * A funding payment, in either shape Hyperliquid ships it.
 *
 * The REST `userFunding` endpoint nests the payload under `delta` and includes
 * a `hash`; the `userFundings` WebSocket channel sends the same fields FLAT,
 * with no `delta` and no `hash`. Both are represented here — use
 * `fundingFields()` rather than reading either shape directly.
 */
export type FundingEntry =
  | { time: number; hash: string; delta: FundingDelta }
  | ({ time: number; hash?: undefined } & FundingDelta);

/** Normalises either shape to the payload fields. */
export function fundingFields(e: FundingEntry): FundingDelta {
  return 'delta' in e && e.delta ? e.delta : (e as FundingDelta);
}

export interface UserFill {
  coin: string;
  px: string;
  sz: string;
  side: 'B' | 'A';
  time: number;
  dir: string; // e.g. "Open Long", "Close Short"
  closedPnl: string;
  fee: string;
  feeToken: string;
  oid: number;
  hash: string;
}
