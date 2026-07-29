import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { fetchCandles } from '../lib/api';
import { formatPx } from '../lib/format';
import { hlSocket } from '../lib/ws';
import { useMarket } from '../state/market';
import type { Candle, CandleInterval } from '../lib/types';

/** Timeframe buttons — label shown, value is the Hyperliquid interval. */
const INTERVALS: { label: string; value: CandleInterval }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1M' },
];

/** Lookback per interval — sized to ~400-900 candles of history each. */
const LOOKBACK_MS: Record<CandleInterval, number> = {
  '1m': 12 * 3600_000,
  '5m': 3 * 86_400_000,
  '15m': 7 * 86_400_000,
  '30m': 14 * 86_400_000,
  '1h': 30 * 86_400_000,
  '4h': 120 * 86_400_000,
  '1d': 365 * 86_400_000,
  '1w': 3 * 365 * 86_400_000,
  '1M': 6 * 365 * 86_400_000,
};

const GREEN = '#2ebd85';
const RED = '#f6465d';

/** Candles visible on load. History stays scrollable — we just don't cram it all
 *  into the viewport, which is what makes bars render as hairlines. */
const VISIBLE_BARS = 140;
/** Pixels per bar at rest; exchanges sit around 8-10. */
const BAR_SPACING = 8;
/** Empty bars kept to the right of the newest candle. */
const RIGHT_OFFSET = 12;
const PRICE_MAS = [
  { period: 7, color: '#f0a020' },
  { period: 25, color: '#4a9eff' },
  { period: 99, color: '#b06ae0' },
];
const VOL_MAS = [
  { period: 5, color: '#f0a020' },
  { period: 10, color: '#4a9eff' },
];

interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

function toSec(ms: number): UTCTimestamp {
  return Math.floor(ms / 1000) as UTCTimestamp;
}

function toBar(c: Candle): Bar {
  return {
    t: c.t,
    o: Number(c.o),
    h: Number(c.h),
    l: Number(c.l),
    c: Number(c.c),
    v: Number(c.v),
  };
}

/** Simple moving average; bars without enough history are omitted. */
function sma(src: { time: UTCTimestamp; value: number }[], period: number) {
  const out: { time: UTCTimestamp; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    sum += src[i].value;
    if (i >= period) sum -= src[i - period].value;
    if (i >= period - 1) out.push({ time: src[i].time, value: sum / period });
  }
  return out;
}

function compact(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return v.toFixed(2);
}

function stamp(ms: number, interval: CandleInterval): string {
  const d = new Date(ms);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (interval === '1d' || interval === '1w' || interval === '1M') return date;
  return `${date}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export function ChartPanel() {
  const { coin, market } = useMarket();
  const szDecimals = market?.meta.szDecimals ?? 3;
  const [interval, setIntervalTf] = useState<CandleInterval>('5m');
  const [hover, setHover] = useState<Bar | null>(null);
  const [last, setLast] = useState<Bar | null>(null);
  /** Surfaced in the OHLC row — a silent catch here is how a blank chart hides a real failure. */
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volSeries = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceMas = useRef<ISeriesApi<'Line'>[]>([]);
  const volMas = useRef<ISeriesApi<'Line'>[]>([]);
  /** All bars by epoch-second, so the crosshair can read O/H/L/C/V without a refetch. */
  const bars = useRef<Map<number, Bar>>(new Map());
  /** Head of the series — tracked rather than recomputed, since ticks are frequent. */
  const newest = useRef(0);

  // Build the chart once: price pane (0) + dedicated volume pane (1).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8b8b93',
        fontSize: 11,
        attributionLogo: false,
        // Default separator is a light #2B2B43 that reads as a white bar on this
        // dark theme — match the borders used elsewhere in the app.
        panes: {
          enableResize: true,
          separatorColor: '#232329',
          separatorHoverColor: 'rgba(255,255,255,0.10)',
        },
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)', style: LineStyle.Dotted },
        horzLines: { color: 'rgba(255,255,255,0.05)', style: LineStyle.Dotted },
      },
      rightPriceScale: { borderColor: '#232329', scaleMargins: { top: 0.12, bottom: 0.06 } },
      timeScale: {
        borderColor: '#232329',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: BAR_SPACING,
        minBarSpacing: 0.5,
        rightOffset: RIGHT_OFFSET,
        rightBarStaysOnScroll: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#6a6a78', style: LineStyle.Dashed, labelBackgroundColor: '#2a2a32' },
        horzLine: { color: '#6a6a78', style: LineStyle.Dashed, labelBackgroundColor: '#2a2a32' },
      },
      autoSize: true,
    });

    candleSeries.current = chart.addSeries(CandlestickSeries, {
      upColor: GREEN,
      downColor: RED,
      wickUpColor: GREEN,
      wickDownColor: RED,
      borderVisible: false,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineStyle: 2,
    });
    priceMas.current = PRICE_MAS.map((m) =>
      chart.addSeries(LineSeries, {
        color: m.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      }),
    );

    volSeries.current = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: 'volume' }, priceLineVisible: false },
      1,
    );
    volMas.current = VOL_MAS.map((m) =>
      chart.addSeries(
        LineSeries,
        {
          color: m.color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        },
        1,
      ),
    );
    // Keep the volume pane compact so the candles get the vertical room.
    chart.panes()[1]?.setHeight(90);

    chart.subscribeCrosshairMove((param) => {
      const t = param.time as number | undefined;
      setHover(t === undefined ? null : (bars.current.get(t) ?? null));
    });

    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeries.current = null;
      volSeries.current = null;
      priceMas.current = [];
      volMas.current = [];
    };
  }, []);

  // History + live stream, per (coin, interval).
  useEffect(() => {
    let cancelled = false;
    bars.current = new Map();
    newest.current = 0;
    setHover(null);
    setLast(null);
    setError(null);
    setLoading(true);
    candleSeries.current?.setData([]);
    volSeries.current?.setData([]);
    priceMas.current.forEach((s) => s.setData([]));
    volMas.current.forEach((s) => s.setData([]));

    const volColor = (b: Bar) =>
      b.c >= b.o ? 'rgba(46,189,133,0.5)' : 'rgba(246,70,93,0.5)';

    const redrawMas = () => {
      const sorted = [...bars.current.entries()].sort((a, b) => a[0] - b[0]);
      const closes = sorted.map(([t, b]) => ({ time: t as UTCTimestamp, value: b.c }));
      const vols = sorted.map(([t, b]) => ({ time: t as UTCTimestamp, value: b.v }));
      PRICE_MAS.forEach((m, i) => priceMas.current[i]?.setData(sma(closes, m.period)));
      VOL_MAS.forEach((m, i) => volMas.current[i]?.setData(sma(vols, m.period)));
    };

    void fetchCandles(coin, interval, Date.now() - LOOKBACK_MS[interval], Date.now())
      .then((candles) => {
        if (cancelled || !candleSeries.current) return;
        if (candles.length === 0) {
          setError('No candle history returned');
          setLoading(false);
          return;
        }
        const list = candles.map(toBar);
        list.forEach((b) => bars.current.set(toSec(b.t), b));
        newest.current = toSec(list[list.length - 1].t);
        candleSeries.current.setData(
          list.map((b) => ({ time: toSec(b.t), open: b.o, high: b.h, low: b.l, close: b.c })),
        );
        volSeries.current?.setData(
          list.map((b) => ({ time: toSec(b.t), value: b.v, color: volColor(b) })),
        );
        redrawMas();
        setLast(list[list.length - 1]);
        setLoading(false);
        // Show only the most recent window at readable width; fitContent() would
        // squeeze every bar of history into the viewport as hairlines.
        chartRef.current?.timeScale().setVisibleLogicalRange({
          from: Math.max(0, list.length - VISIBLE_BARS),
          to: list.length + RIGHT_OFFSET,
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // Surface it — previously this was swallowed, leaving an empty chart with no clue.
        setError(e instanceof Error ? e.message : 'Failed to load candles');
        setLoading(false);
      });

    const unsub = hlSocket.subscribe({ type: 'candle', coin, interval }, (data) => {
      if (cancelled || !candleSeries.current) return;
      const b = toBar(data as Candle);
      const sec = toSec(b.t);
      // Ignore bars behind the series head: lightweight-charts throws if update()
      // is called with a timestamp older than the last bar.
      if (sec < newest.current) return;
      newest.current = sec;
      bars.current.set(sec, b);
      candleSeries.current.update({ time: sec, open: b.o, high: b.h, low: b.l, close: b.c });
      volSeries.current?.update({ time: sec, value: b.v, color: volColor(b) });
      redrawMas();
      setLast(b);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coin, interval]);

  const shown = hover ?? last;
  const up = shown ? shown.c >= shown.o : true;
  const cls = `num ${up ? 'up' : 'down'}`;

  return (
    <div className="chart">
      <div className="chart__toolbar">
        {INTERVALS.map((tf) => (
          <button
            key={tf.value}
            className={`tf-btn${tf.value === interval ? ' tf-btn--active' : ''}`}
            onClick={() => setIntervalTf(tf.value)}
          >
            {tf.label}
          </button>
        ))}
        <span className="chart__spacer" />
        <span className="chart__venue dim">
          {coin}/USDC · {bars.current.size} bars · HYPERLIQUID
        </span>
      </div>

      <div className="chart__ohlc">
        {error ? (
          <span className="down">Chart data unavailable — {error}</span>
        ) : loading ? (
          <span className="dim">Loading {interval} candles…</span>
        ) : shown ? (
          <>
            <span className="dim">Time:</span>
            <span className="num">{stamp(shown.t, interval)}</span>
            <span className="dim">Open:</span>
            <span className={cls}>{formatPx(shown.o, szDecimals)}</span>
            <span className="dim">High:</span>
            <span className={cls}>{formatPx(shown.h, szDecimals)}</span>
            <span className="dim">Low:</span>
            <span className={cls}>{formatPx(shown.l, szDecimals)}</span>
            <span className="dim">Close:</span>
            <span className={cls}>{formatPx(shown.c, szDecimals)}</span>
            <span className="dim">Volume:</span>
            <span className={cls}>{compact(shown.v)}</span>
          </>
        ) : null}
      </div>

      <div className="chart__canvas" ref={containerRef}>
        <div className="chart__ma">
          <b>MA</b>
          <span className="dim">{PRICE_MAS.map((m) => m.period).join(', ')}</span>
          {PRICE_MAS.map((m, i) => (
            <span key={m.period} style={{ color: m.color }}>
              MA{i + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
