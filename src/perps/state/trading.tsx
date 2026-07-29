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
import { useTerminalAddress } from '../lib/aussivoWallet';
import { getConnectorClient, switchChain } from 'wagmi/actions';
import { arbitrum } from 'wagmi/chains';
import { walletActions } from 'viem';
import { ExchangeClient, HttpTransport } from '@nktkas/hyperliquid';
import type { PrivateKeyAccount } from 'viem/accounts';
import { wagmiConfig } from '../lib/wagmi';
import {
  BUILDER_ADDRESS,
  BUILDER_FEE,
  BUILDER_MAX_FEE_RATE,
  IS_TESTNET,
} from '../config';
import {
  AGENT_UNLOCK_MESSAGE,
  clearStoredAgent,
  createAgent,
  hasStoredAgent,
  restoreSessionAgent,
  unlockAgent,
} from '../lib/agent';
import { fetchMaxBuilderFee } from '../lib/api';
import { pxDecimals } from '../lib/format';
import { useToast } from '../components/Toasts';
import type { MarketInfo } from './market';

/**
 * Trading readiness:
 *  - disconnected: no wallet
 *  - setup: connected, no agent yet — run onboarding (approve fee + agent)
 *  - locked: agent stored but not decrypted this session — one unlock signature
 *  - ready: agent in memory, orders sign silently
 */
export type TradingStatus = 'disconnected' | 'setup' | 'locked' | 'ready';

export interface PlaceOrderParams {
  market: MarketInfo;
  isBuy: boolean;
  /** Limit px as entered; ignored for market orders. */
  limitPx: number;
  sz: number;
  reduceOnly: boolean;
  tif: 'Gtc' | 'Ioc' | 'Alo';
  orderKind: 'limit' | 'market' | 'stopMarket' | 'stopLimit';
  /** Mid price, used to derive the aggressive market-order price. */
  mid: number;
  /** Trigger price for stop orders. */
  triggerPx?: number;
  /** Max slippage for market-style execution (fraction; default 0.05). */
  slippage?: number;
  /** Optional take-profit / stop-loss trigger prices, attached as reduce-only
   *  market trigger orders grouped with the entry (normalTpsl). */
  tpPx?: number;
  slPx?: number;
}

export interface ScaleParams {
  market: MarketInfo;
  isBuy: boolean;
  startPx: number;
  endPx: number;
  totalSz: number;
  count: number;
  /** Size ratio of last order vs first (1 = equal sizes). */
  skew: number;
  reduceOnly: boolean;
  tif: 'Gtc' | 'Ioc' | 'Alo';
}

export interface TwapParams {
  market: MarketInfo;
  isBuy: boolean;
  sz: number;
  minutes: number; // 5..1440 (HL constraint)
  reduceOnly: boolean;
  randomize: boolean;
}

interface TradingState {
  status: TradingStatus;
  busy: boolean;
  builderApproved: boolean;
  enableTrading: () => Promise<void>;
  unlock: () => Promise<void>;
  resetAgent: () => void;
  placeOrder: (p: PlaceOrderParams) => Promise<boolean>;
  /** Scale: N limit orders across [startPx, endPx] with linear size skew. */
  placeScale: (p: ScaleParams) => Promise<boolean>;
  /** Native Hyperliquid TWAP (30s sub-orders). */
  placeTwap: (p: TwapParams) => Promise<boolean>;
  cancelOrder: (assetIndex: number, oid: number) => Promise<void>;
  cancelAll: (cancels: { a: number; o: number }[]) => Promise<void>;
  /** Close a position at market (reduce-only IoC), fully or partially. */
  closePosition: (market: MarketInfo, szi: number, fraction?: number) => Promise<void>;
  setLeverage: (assetIndex: number, leverage: number, isCross: boolean) => Promise<void>;
  /** Stop a running TWAP. */
  cancelTwap: (assetIndex: number, twapId: number) => Promise<void>;
  /** Move USDC between the Spot and Perps balance sheets. Main-wallet signature. */
  transferUsdClass: (amount: number, toPerp: boolean) => Promise<boolean>;
  /** Withdraw USDC to an Arbitrum address. Main-wallet signature — agents cannot. */
  withdraw: (destination: string, amount: number) => Promise<boolean>;
}

const TradingContext = createContext<TradingState | null>(null);

const MARKET_SLIPPAGE = 0.05;

/** Round a price to Hyperliquid's rules (5 sig figs, max 6 - szDecimals dp). */
export function roundPx(px: number, szDecimals: number): string {
  return px.toFixed(pxDecimals(szDecimals, px));
}

function errMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.length > 220 ? `${m.slice(0, 220)}…` : m;
}

/**
 * User-signed HL actions are EIP-712 typed data with chainId = Arbitrum, and
 * MetaMask refuses typed data whose chainId differs from the active network —
 * so switch (or add) Arbitrum first, then fetch a fresh wallet client.
 */
async function getUserWallet() {
  try {
    await switchChain(wagmiConfig, { chainId: arbitrum.id });
  } catch (e) {
    // Rejected or wallet already on Arbitrum without switch support — signing
    // below will surface a clear error if the chain is actually wrong.
    console.warn('chain switch skipped:', e);
  }
  const client = await getConnectorClient(wagmiConfig, { chainId: arbitrum.id });
  return client.extend(walletActions);
}

export function TradingProvider({ children }: { children: ReactNode }) {
  const address = useTerminalAddress();
  const toast = useToast();
  const [agent, setAgent] = useState<PrivateKeyAccount | null>(null);
  const [stored, setStored] = useState(false);
  const [builderApproved, setBuilderApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  /**
   * Synchronous re-entry guard. `setBusy(true)` only disables the button on the
   * NEXT render, so a fast double-click slips through and submits twice — with
   * real money that means two live orders. A ref flips immediately.
   */
  const inFlight = useRef(false);

  // The SDK default is 10s, which a wallet-signed action can blow through while
  // the user is still looking at the MetaMask prompt.
  const transport = useMemo(
    () => new HttpTransport({ isTestnet: IS_TESTNET, timeout: 60_000 }),
    [],
  );

  const prevAddress = useRef<string | undefined>(undefined);

  // Reset per-wallet session state when the wallet actually changes.
  useEffect(() => {
    const prev = prevAddress.current;
    // Only a genuinely different wallet should discard the decrypted agent.
    // wagmi briefly reports `undefined` while reconnecting (chain switch, popup,
    // provider re-init); wiping on that forced a fresh unlock signature every time.
    if (address && prev && address !== prev) {
      setAgent(null);
      setBuilderApproved(false);
    }
    if (address) prevAddress.current = address;

    // Restore the decrypted agent from the tab-session cache — this is what makes
    // a reload keep "ready" instead of dropping back to "Unlock Trading".
    if (address) {
      const cached = restoreSessionAgent(address);
      if (cached) setAgent(cached);
    }

    setStored(address ? hasStoredAgent(address) : false);
    if (address && BUILDER_ADDRESS) {
      fetchMaxBuilderFee(address, BUILDER_ADDRESS)
        .then((f) => setBuilderApproved(f >= BUILDER_FEE))
        .catch(() => setBuilderApproved(false));
    }
    // Runs only on address change; `agent` is intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const status: TradingStatus = !address
    ? 'disconnected'
    : agent
      ? 'ready'
      : stored
        ? 'locked'
        : 'setup';

  const agentClient = useMemo(
    () => (agent ? new ExchangeClient({ transport, wallet: agent }) : null),
    [transport, agent],
  );

  /** Full onboarding: builder-fee approval (if configured) + agent approval. */
  const enableTrading = useCallback(async () => {
    if (!address) return;
    setBusy(true);
    try {
      const wallet = await getUserWallet();
      const userClient = new ExchangeClient({ transport, wallet });

      if (BUILDER_ADDRESS && !builderApproved) {
        await userClient.approveBuilderFee({
          maxFeeRate: BUILDER_MAX_FEE_RATE,
          builder: BUILDER_ADDRESS as `0x${string}`,
        });
        setBuilderApproved(true);
        toast({ kind: 'success', title: 'Builder fee approved', detail: BUILDER_MAX_FEE_RATE });
      }

      const unlockSig = await wallet.signMessage({ message: AGENT_UNLOCK_MESSAGE });
      const newAgent = await createAgent(address, unlockSig);
      await userClient.approveAgent({ agentAddress: newAgent.address, agentName: 'builderfi' });
      setAgent(newAgent);
      setStored(true);
      toast({ kind: 'success', title: 'Trading enabled', detail: 'Orders now sign without popups' });
    } catch (e) {
      clearStoredAgent(address);
      setStored(false);
      toast({ kind: 'error', title: 'Onboarding failed', detail: errMessage(e) });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [address, transport, builderApproved, toast]);

  /** New session with a stored agent: one signature to decrypt it. */
  const unlock = useCallback(async () => {
    if (!address) return;
    setBusy(true);
    try {
      const wallet = await getUserWallet();
      const sig = await wallet.signMessage({ message: AGENT_UNLOCK_MESSAGE });
      const acct = await unlockAgent(address, sig);
      if (!acct) {
        // Corrupt or signed by a different key — start over.
        clearStoredAgent(address);
        setStored(false);
        toast({ kind: 'info', title: 'Stored agent invalid', detail: 'Run Enable Trading again' });
        return;
      }
      setAgent(acct);
      toast({ kind: 'success', title: 'Trading unlocked' });
    } catch (e) {
      toast({ kind: 'error', title: 'Unlock failed', detail: errMessage(e) });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [address, toast]);

  const resetAgent = useCallback(() => {
    if (address) clearStoredAgent(address);
    setAgent(null);
    setStored(false);
  }, [address]);

  const placeOrder = useCallback(
    async (p: PlaceOrderParams): Promise<boolean> => {
      if (!agentClient || inFlight.current) return false;
      inFlight.current = true;
      const { szDecimals } = p.market.meta;
      const isStop = p.orderKind === 'stopMarket' || p.orderKind === 'stopLimit';
      // Execution price: aggressive bound for market-style fills, user limit
      // otherwise. Stop-market bounds execution around the trigger price.
      const slip = p.slippage ?? MARKET_SLIPPAGE;
      const rawPx =
        p.orderKind === 'market'
          ? p.mid * (p.isBuy ? 1 + slip : 1 - slip)
          : p.orderKind === 'stopMarket'
            ? (p.triggerPx ?? 0) * (p.isBuy ? 1 + slip : 1 - slip)
            : p.limitPx;
      const sz = p.sz.toFixed(szDecimals);
      const entry = {
        a: p.market.index,
        b: p.isBuy,
        p: roundPx(rawPx, szDecimals),
        s: sz,
        r: p.reduceOnly,
        t: isStop
          ? {
              trigger: {
                isMarket: p.orderKind === 'stopMarket',
                triggerPx: roundPx(p.triggerPx ?? 0, szDecimals),
                tpsl: 'sl' as const, // standalone stops use stop-loss trigger semantics
              },
            }
          : { limit: { tif: p.orderKind === 'market' ? ('Ioc' as const) : p.tif } },
      };
      // TP/SL ride along as reduce-only market trigger orders on the flipped
      // side; `p` bounds the triggered market execution.
      const trigger = (kind: 'tp' | 'sl', triggerPx: number) => ({
        a: p.market.index,
        b: !p.isBuy,
        p: roundPx(triggerPx * (p.isBuy ? 1 - MARKET_SLIPPAGE : 1 + MARKET_SLIPPAGE), szDecimals),
        s: sz,
        r: true,
        t: { trigger: { isMarket: true, triggerPx: roundPx(triggerPx, szDecimals), tpsl: kind } },
      });
      const orders = [
        entry,
        ...(p.tpPx ? [trigger('tp', p.tpPx)] : []),
        ...(p.slPx ? [trigger('sl', p.slPx)] : []),
      ];
      setBusy(true);
      try {
        const result = await agentClient.order({
          orders,
          grouping: orders.length > 1 ? 'normalTpsl' : 'na',
          // The revenue switch: every fill pays the approved builder fee.
          ...(BUILDER_ADDRESS && builderApproved
            ? { builder: { b: BUILDER_ADDRESS as `0x${string}`, f: BUILDER_FEE } }
            : {}),
        });
        const st = result.response.data.statuses[0];
        if (st && typeof st === 'object' && 'error' in st) {
          toast({ kind: 'error', title: 'Order rejected', detail: String(st.error) });
          return false;
        }
        // A fill reports the real average price and size; a resting order only
        // echoes what we sent, so report each accordingly rather than guessing.
        const fill =
          st && typeof st === 'object' && 'filled' in st
            ? (st.filled as { totalSz?: string; avgPx?: string; oid?: number })
            : null;
        const side = p.isBuy ? 'Buy' : 'Sell';
        const coin = p.market.meta.name;
        toast({
          kind: 'success',
          title: fill ? `Filled ${side} ${fill.totalSz ?? entry.s} ${coin}` : `Order placed`,
          detail: fill
            ? `Avg ${fill.avgPx ?? entry.p} · ${orders.length > 1 ? 'TP/SL attached · ' : ''}order #${fill.oid ?? '—'}`
            : `${side} ${entry.s} ${coin} resting @ ${entry.p}${orders.length > 1 ? ' · TP/SL attached' : ''}`,
        });
        return true;
      } catch (e) {
        toast({ kind: 'error', title: 'Order failed', detail: errMessage(e) });
        return false;
      } finally {
        inFlight.current = false;
      setBusy(false);
      }
    },
    [agentClient, builderApproved, toast],
  );

  const placeScale = useCallback(
    async (p: ScaleParams): Promise<boolean> => {
      if (!agentClient || inFlight.current) return false;
      inFlight.current = true;
      const { szDecimals } = p.market.meta;
      const n = Math.max(2, Math.min(50, Math.round(p.count)));
      // Linear size weights from 1 to skew, normalized to the total size.
      const weights = Array.from({ length: n }, (_, i) => 1 + (p.skew - 1) * (i / (n - 1)));
      const wSum = weights.reduce((a, b) => a + b, 0);
      const orders = weights.map((w, i) => {
        const px = p.startPx + ((p.endPx - p.startPx) * i) / (n - 1);
        return {
          a: p.market.index,
          b: p.isBuy,
          p: roundPx(px, szDecimals),
          s: ((p.totalSz * w) / wSum).toFixed(szDecimals),
          r: p.reduceOnly,
          t: { limit: { tif: p.tif } },
        };
      });
      setBusy(true);
      try {
        const result = await agentClient.order({
          orders,
          grouping: 'na',
          ...(BUILDER_ADDRESS && builderApproved
            ? { builder: { b: BUILDER_ADDRESS as `0x${string}`, f: BUILDER_FEE } }
            : {}),
        });
        const errs = result.response.data.statuses.filter(
          (s: unknown) => s && typeof s === 'object' && 'error' in (s as object),
        );
        if (errs.length === orders.length) {
          const first = errs[0] as unknown as { error: string };
          toast({ kind: 'error', title: 'Scale rejected', detail: String(first.error) });
          return false;
        }
        toast({
          kind: 'success',
          title: `Placed ${orders.length - errs.length}/${orders.length} scale orders`,
          detail: `${p.market.meta.name} ${roundPx(p.startPx, szDecimals)} → ${roundPx(p.endPx, szDecimals)}`,
        });
        return true;
      } catch (e) {
        toast({ kind: 'error', title: 'Scale failed', detail: errMessage(e) });
        return false;
      } finally {
        inFlight.current = false;
      setBusy(false);
      }
    },
    [agentClient, builderApproved, toast],
  );

  const placeTwap = useCallback(
    async (p: TwapParams): Promise<boolean> => {
      if (!agentClient || inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);
      try {
        await agentClient.twapOrder({
          twap: {
            a: p.market.index,
            b: p.isBuy,
            s: p.sz.toFixed(p.market.meta.szDecimals),
            r: p.reduceOnly,
            m: Math.max(5, Math.min(1440, Math.round(p.minutes))),
            t: p.randomize,
          },
        });
        toast({
          kind: 'success',
          title: 'TWAP started',
          detail: `${p.isBuy ? 'Buy' : 'Sell'} ${p.sz} ${p.market.meta.name} over ${p.minutes}m`,
        });
        return true;
      } catch (e) {
        toast({ kind: 'error', title: 'TWAP failed', detail: errMessage(e) });
        return false;
      } finally {
        inFlight.current = false;
      setBusy(false);
      }
    },
    [agentClient, toast],
  );

  const cancelOrder = useCallback(
    async (assetIndex: number, oid: number) => {
      if (!agentClient) return;
      try {
        await agentClient.cancel({ cancels: [{ a: assetIndex, o: oid }] });
        toast({ kind: 'success', title: 'Order cancelled' });
      } catch (e) {
        toast({ kind: 'error', title: 'Cancel failed', detail: errMessage(e) });
      }
    },
    [agentClient, toast],
  );

  const cancelAll = useCallback(
    async (cancels: { a: number; o: number }[]) => {
      if (!agentClient || cancels.length === 0) return;
      try {
        await agentClient.cancel({ cancels });
        toast({ kind: 'success', title: `Cancelled ${cancels.length} orders` });
      } catch (e) {
        toast({ kind: 'error', title: 'Cancel all failed', detail: errMessage(e) });
      }
    },
    [agentClient, toast],
  );

  const closePosition = useCallback(
    async (market: MarketInfo, szi: number, fraction = 1) => {
      if (!agentClient || szi === 0 || inFlight.current) return;
      inFlight.current = true;
      const { szDecimals } = market.meta;
      const closeBuy = szi < 0; // buy back shorts, sell longs
      const mid = Number(market.ctx.midPx ?? market.ctx.markPx);
      const sz = Math.abs(szi) * fraction;
      try {
        const result = await agentClient.order({
          orders: [
            {
              a: market.index,
              b: closeBuy,
              p: roundPx(mid * (closeBuy ? 1 + MARKET_SLIPPAGE : 1 - MARKET_SLIPPAGE), szDecimals),
              s: sz.toFixed(szDecimals),
              r: true,
              t: { limit: { tif: 'Ioc' } },
            },
          ],
          grouping: 'na',
          ...(BUILDER_ADDRESS && builderApproved
            ? { builder: { b: BUILDER_ADDRESS as `0x${string}`, f: BUILDER_FEE } }
            : {}),
        });
        const st = result.response.data.statuses[0];
        if (st && typeof st === 'object' && 'error' in st) {
          toast({ kind: 'error', title: 'Close failed', detail: String(st.error) });
        } else {
          toast({
            kind: 'success',
            title: fraction === 1 ? 'Position closed' : 'Position reduced',
            detail: `${market.meta.name} ${sz.toFixed(szDecimals)}`,
          });
        }
      } catch (e) {
        toast({ kind: 'error', title: 'Close failed', detail: errMessage(e) });
      } finally {
        // Every other action releases the guard in a finally; this one did not,
        // so a single close left `inFlight` stuck true and silently blocked all
        // later orders, cancels, transfers and withdrawals until a page reload.
        inFlight.current = false;
      }
    },
    [agentClient, builderApproved, toast],
  );

  const cancelTwap = useCallback(
    async (assetIndex: number, twapId: number) => {
      if (!agentClient) return;
      try {
        await agentClient.twapCancel({ a: assetIndex, t: twapId });
        toast({ kind: 'success', title: 'TWAP cancelled' });
      } catch (e) {
        toast({ kind: 'error', title: 'TWAP cancel failed', detail: errMessage(e) });
      }
    },
    [agentClient, toast],
  );

  /**
   * Spot <-> Perps transfer. Signed by the main wallet, not the agent: it moves
   * value between balance sheets, which agent keys are deliberately not trusted with.
   */
  const transferUsdClass = useCallback(
    async (amount: number, toPerp: boolean): Promise<boolean> => {
      if (!address || amount <= 0 || inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);
      try {
        const wallet = await getUserWallet();
        const userClient = new ExchangeClient({ transport, wallet });
        await userClient.usdClassTransfer({ amount: amount.toFixed(2), toPerp });
        toast({
          kind: 'success',
          title: `Moved to ${toPerp ? 'Perps' : 'Spot'}`,
          detail: `${amount.toFixed(2)} USDC`,
        });
        return true;
      } catch (e) {
        toast({ kind: 'error', title: 'Transfer failed', detail: errMessage(e) });
        return false;
      } finally {
        inFlight.current = false;
      setBusy(false);
      }
    },
    [address, transport, toast],
  );

  /** Withdraw to Arbitrum. Hyperliquid deducts a flat $1 fee; arrives in ~5 min. */
  const withdraw = useCallback(
    async (destination: string, amount: number): Promise<boolean> => {
      if (!address || amount <= 0 || inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);
      try {
        const wallet = await getUserWallet();
        const userClient = new ExchangeClient({ transport, wallet });
        await userClient.withdraw3({
          destination: destination as `0x${string}`,
          amount: amount.toFixed(2),
        });
        toast({
          kind: 'success',
          title: 'Withdrawal submitted',
          detail: `${amount.toFixed(2)} USDC to ${destination.slice(0, 6)}…${destination.slice(-4)}`,
        });
        return true;
      } catch (e) {
        toast({ kind: 'error', title: 'Withdrawal failed', detail: errMessage(e) });
        return false;
      } finally {
        inFlight.current = false;
      setBusy(false);
      }
    },
    [address, transport, toast],
  );

  const setLeverage = useCallback(
    async (assetIndex: number, leverage: number, isCross: boolean) => {
      if (!agentClient) return;
      try {
        await agentClient.updateLeverage({ asset: assetIndex, isCross, leverage });
        toast({ kind: 'success', title: `Leverage set to ${leverage}x` });
      } catch (e) {
        toast({ kind: 'error', title: 'Leverage update failed', detail: errMessage(e) });
      }
    },
    [agentClient, toast],
  );

  const value = useMemo<TradingState>(
    () => ({
      status,
      busy,
      builderApproved,
      enableTrading,
      unlock,
      resetAgent,
      placeOrder,
      placeScale,
      placeTwap,
      cancelOrder,
      cancelAll,
      closePosition,
      setLeverage,
      cancelTwap,
      transferUsdClass,
      withdraw,
    }),
    [status, busy, builderApproved, enableTrading, unlock, resetAgent, placeOrder, placeScale, placeTwap, cancelOrder, cancelAll, closePosition, setLeverage, cancelTwap, transferUsdClass, withdraw],
  );

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
}

export function useTrading(): TradingState {
  const ctx = useContext(TradingContext);
  if (!ctx) throw new Error('useTrading outside TradingProvider');
  return ctx;
}
