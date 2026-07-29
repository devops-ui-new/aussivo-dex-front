import { HL_WS_URL } from '../config';

type Subscription = Record<string, unknown> & { type: string };
type Listener = (data: unknown) => void;

interface Entry {
  sub: Subscription;
  listeners: Set<Listener>;
}

function keyOf(sub: Subscription): string {
  return JSON.stringify(sub, Object.keys(sub).sort());
}

/**
 * Single shared Hyperliquid WebSocket with ref-counted subscriptions and
 * auto-resubscribe on reconnect.
 */
interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const POST_TIMEOUT_MS = 15_000;

class HlSocket {
  private ws: WebSocket | null = null;
  private entries = new Map<string, Entry>();
  private retry = 0;
  private opening = false;
  /** Outstanding request/response posts, keyed by id. */
  private pending = new Map<number, Pending>();
  /** Frames queued while the socket is still connecting. */
  private queue: unknown[] = [];
  private nextId = 1;

  /**
   * Request/response over the same socket (`method: "post"`), so one-shot reads
   * like the market universe or candle history don't need a separate HTTP round
   * trip. Hyperliquid answers on the `post` channel with a matching id.
   */
  post<T>(payload: Record<string, unknown>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`WS post ${String(payload.type)}: timed out`));
      }, POST_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });
      this.send({ method: 'post', id, request: { type: 'info', payload } });
      this.ensureOpen();
    });
  }

  subscribe(sub: Subscription, listener: Listener): () => void {
    const key = keyOf(sub);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { sub, listeners: new Set() };
      this.entries.set(key, entry);
      this.send({ method: 'subscribe', subscription: sub });
    }
    entry.listeners.add(listener);
    this.ensureOpen();
    return () => {
      const e = this.entries.get(key);
      if (!e) return;
      e.listeners.delete(listener);
      if (e.listeners.size === 0) {
        this.entries.delete(key);
        this.send({ method: 'unsubscribe', subscription: sub });
      }
    };
  }

  private ensureOpen(): void {
    if (this.ws || this.opening) return;
    this.opening = true;
    const ws = new WebSocket(HL_WS_URL);
    ws.onopen = () => {
      this.ws = ws;
      this.opening = false;
      this.retry = 0;
      for (const { sub } of this.entries.values()) {
        ws.send(JSON.stringify({ method: 'subscribe', subscription: sub }));
      }
      // Flush anything that was requested before the socket finished connecting.
      const queued = this.queue;
      this.queue = [];
      for (const frame of queued) ws.send(JSON.stringify(frame));
    };
    ws.onmessage = (ev) => {
      let msg: { channel?: string; data?: unknown };
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (msg.channel === 'post') {
        // { data: { id, response: { type, payload: { data } } } }
        const d = msg.data as
          | { id?: number; response?: { type?: string; payload?: { data?: unknown } } }
          | undefined;
        const p = d?.id !== undefined ? this.pending.get(d.id) : undefined;
        if (p && d?.id !== undefined) {
          clearTimeout(p.timer);
          this.pending.delete(d.id);
          if (d.response?.type === 'error') p.reject(new Error(String(d.response.payload)));
          else p.resolve(d.response?.payload?.data);
        }
        return;
      }
      if (!msg.channel || msg.channel === 'subscriptionResponse' || msg.channel === 'error') return;
      // Fan out by channel: match entries whose sub type maps to this channel.
      for (const entry of this.entries.values()) {
        if (this.matches(entry.sub, msg)) {
          for (const l of entry.listeners) l(msg.data);
        }
      }
    };
    ws.onclose = () => {
      this.ws = null;
      this.opening = false;
      if (this.entries.size > 0) {
        const delay = Math.min(10_000, 500 * 2 ** this.retry++);
        setTimeout(() => this.ensureOpen(), delay);
      }
    };
    ws.onerror = () => ws.close();
  }

  private matches(sub: Subscription, msg: { channel?: string; data?: unknown }): boolean {
    if (sub.type !== msg.channel) return false;
    const d = msg.data as Record<string, unknown> | unknown[] | undefined;
    const coin = (sub as { coin?: string }).coin;
    if (!coin) return true;
    if (Array.isArray(d)) return d.length > 0 && (d[0] as { coin?: string }).coin === coin;
    if (d && typeof d === 'object') {
      const dc = (d as { coin?: string; s?: string }).coin ?? (d as { s?: string }).s;
      if (dc !== undefined) {
        const interval = (sub as { interval?: string }).interval;
        const di = (d as { i?: string }).i;
        return dc === coin && (interval === undefined || di === undefined || di === interval);
      }
    }
    return true;
  }

  private send(payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return;
    }
    // Only posts are queued. Subscribes are already replayed from `entries` in
    // onopen, so queueing them too would subscribe twice.
    if ((payload as { method?: string }).method === 'post') this.queue.push(payload);
  }
}

export const hlSocket = new HlSocket();
