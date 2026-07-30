import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTerminalAddress } from '../lib/aussivoWallet';
import { fetchUserAbstraction } from '../lib/api';
import { hlSocket } from '../lib/ws';
import type {
  AssetPosition,
  ClearinghouseState,
  OpenOrder,
  SpotBalance,
  UserFill,
} from '../lib/types';

interface AccountState {
  address: string | null;
  /** Perps clearinghouse snapshot; null when disconnected or not yet loaded. */
  clearinghouse: ClearinghouseState | null;
  /** Spot holdings — where bridge deposits land, separate from perps margin. */
  spotBalances: SpotBalance[];
  /** Spot USDC available to transfer into Perps. */
  spotUsdc: number;
  /** "default" | "unifiedAccount" | "portfolioMargin" — unified disables transfers. */
  abstraction: string;
  isUnified: boolean;
  openOrders: OpenOrder[];
  fills: UserFill[];
  positions: AssetPosition[];
  /** Position for a coin, if any. */
  positionFor: (coin: string) => AssetPosition | undefined;
}

const AccountContext = createContext<AccountState | null>(null);

/** Fills arrive as a snapshot then incrementally; cap what we retain. */
const MAX_FILLS = 200;

export function AccountProvider({ children }: { children: ReactNode }) {
  const address = useTerminalAddress();
  const [clearinghouse, setClearinghouse] = useState<ClearinghouseState | null>(null);
  const [spotBalances, setSpotBalances] = useState<SpotBalance[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [fills, setFills] = useState<UserFill[]>([]);
  const [abstraction, setAbstraction] = useState('default');

  // Account mode changes only when the user opts in, so one fetch per address.
  useEffect(() => {
    if (!address) {
      setAbstraction('default');
      return;
    }
    let alive = true;
    fetchUserAbstraction(address)
      .then((a) => alive && setAbstraction(typeof a === 'string' ? a : 'default'))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [address]);

  useEffect(() => {
    if (!address) {
      setClearinghouse(null);
      setSpotBalances([]);
      setOpenOrders([]);
      setFills([]);
      return;
    }
    // Push, not poll: each of these delivers a snapshot on subscribe and then
    // only on change, so the account panel stays live without re-POSTing /info.
    const unsubs = [
      hlSocket.subscribe({ type: 'clearinghouseState', user: address }, (d) =>
        setClearinghouse((d as { clearinghouseState: ClearinghouseState }).clearinghouseState),
      ),
      hlSocket.subscribe({ type: 'spotState', user: address }, (d) =>
        setSpotBalances((d as { spotState?: { balances?: SpotBalance[] } }).spotState?.balances ?? []),
      ),
      hlSocket.subscribe({ type: 'openOrders', user: address }, (d) =>
        setOpenOrders((d as { orders?: OpenOrder[] }).orders ?? []),
      ),
      hlSocket.subscribe({ type: 'userFills', user: address }, (d) => {
        const p = d as { isSnapshot?: boolean; fills?: UserFill[] };
        const incoming = p.fills ?? [];
        setFills((prev) =>
          p.isSnapshot ? incoming : [...incoming.slice().reverse(), ...prev].slice(0, MAX_FILLS),
        );
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [address]);

  const value = useMemo<AccountState>(() => {
    const positions = (clearinghouse?.assetPositions ?? []).filter(
      (p) => Number(p.position.szi) !== 0,
    );
    return {
      address: address ?? null,
      clearinghouse,
      spotBalances,
      spotUsdc: Number(spotBalances.find((b) => b.coin === 'USDC')?.total ?? 0),
      abstraction,
      isUnified: abstraction === 'unifiedAccount',
      openOrders,
      fills,
      positions,
      positionFor: (coin: string) => positions.find((p) => p.position.coin === coin),
    };
  }, [address, clearinghouse, spotBalances, openOrders, fills, abstraction]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useHlAccount(): AccountState {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useHlAccount outside AccountProvider');
  return ctx;
}
