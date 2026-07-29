import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import './styles.css';
import { wagmiConfig } from './lib/wagmi';
import { AccountProvider } from './state/account';
import { TradingProvider } from './state/trading';
import { MarketProvider } from './state/market';
import { AccountPanel } from './components/AccountPanel';
import { BottomPanel } from './components/BottomPanel';
import { ChartPanel } from './components/ChartPanel';
import { MarketHeader } from './components/MarketHeader';
import { OrderBookPanel } from './components/OrderBookPanel';
import { OrderTicket } from './components/OrderTicket';
import { PanelFrame } from './components/PanelFrame';
import { Resizer } from './components/Resizer';
import { StatusBar } from './components/StatusBar';
import { ToastProvider } from './components/Toasts';
import { WalletBridge } from './components/WalletBridge';
import { NetworkPrompt } from './components/NetworkPrompt';
import { PortalRootContext } from './lib/portalRoot';
import {
  DEFAULT_LAYOUT,
  LIMITS,
  clamp,
  loadLayout,
  saveLayout,
  swapPanels,
  type PanelId,
  type SlotId,
} from './lib/layout';

// Scoped to the perp route — the rest of Aussivo has no react-query dependency.
const queryClient = new QueryClient();

const SLOT_ORDER: SlotId[] = ['main', 'side', 'rail', 'bottom'];

function TerminalGrid() {
  const [pickedPrice, setPickedPrice] = useState<number | null>(null);
  const [layout, setLayout] = useState(loadLayout);

  useEffect(() => saveLayout(layout), [layout]);

  const onSwap = useCallback((from: string, to: string) => {
    setLayout((l) => ({ ...l, slots: swapPanels(l.slots, from as PanelId, to as PanelId) }));
  }, []);

  const resize = useCallback(
    (key: 'sideW' | 'railW' | 'bottomH', delta: number) =>
      setLayout((l) => ({ ...l, [key]: clamp(l[key] + delta, LIMITS[key]) })),
    [],
  );

  // Panels are defined once; the slot map decides where each one renders.
  const panels: Record<PanelId, { title: string; scroll?: boolean; node: ReactNode }> = {
    chart: { title: 'Chart', node: <ChartPanel /> },
    book: { title: 'Order Book', node: <OrderBookPanel onPricePick={setPickedPrice} /> },
    trade: {
      title: 'Trade',
      scroll: true,
      node: (
        <>
          <OrderTicket pickedPrice={pickedPrice} />
          <AccountPanel />
        </>
      ),
    },
    tables: { title: 'Positions & Orders', node: <BottomPanel /> },
  };

  return (
    <div className="app">
      {/* No terminal control strip: the Navbar owns identity, AccountPanel
          owns Deposit/Transfer/Withdraw, and StatusBar shows the network. */}
      <NetworkPrompt />
      <MarketHeader />
      <div
        className="terminal"
        style={
          {
            '--side-w': `${layout.sideW}px`,
            '--rail-w': `${layout.railW}px`,
            '--bottom-h': `${layout.bottomH}px`,
          } as React.CSSProperties
        }
      >
        {SLOT_ORDER.map((slot) => {
          const id = layout.slots[slot];
          const p = panels[id];
          return (
            <div className={`slot slot--${slot}`} key={slot}>
              <PanelFrame id={id} title={p.title} scroll={p.scroll} onSwap={onSwap}>
                {p.node}
              </PanelFrame>
            </div>
          );
        })}

        {/* Dragging the main|side splitter right shrinks the side column. */}
        <Resizer axis="x" area="cz1" onResize={(d) => resize('sideW', -d)} />
        <Resizer axis="x" area="cz2" onResize={(d) => resize('railW', -d)} />
        <Resizer axis="y" area="rz" onResize={(d) => resize('bottomH', -d)} />

        <button
          className="layout-reset"
          title="Reset panel layout"
          onClick={() => setLayout(DEFAULT_LAYOUT)}
        >
          Reset layout
        </button>
      </div>
      <StatusBar />
    </div>
  );
}

/**
 * The whole perp terminal, providers included.
 *
 * Everything lives under `.perp-terminal` — styles.css is scoped to that class
 * so the terminal's dense resets (`* { margin: 0 }`, `body { overflow: hidden }`,
 * bare `button`/`input` rules) cannot leak into the Tailwind-styled pages.
 */
export function Terminal() {
  // Portalled overlays (the market picker) mount into this element rather than
  // document.body, so the scoped stylesheet still reaches them.
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  return (
    <div className="perp-terminal" ref={setPortalRoot}>
      <PortalRootContext.Provider value={portalRoot}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {/* Slaves wagmi to the app wallet — must sit inside WagmiProvider. */}
          <WalletBridge />
          <ToastProvider>
            <AccountProvider>
              <TradingProvider>
                <MarketProvider>
                  <TerminalGrid />
                </MarketProvider>
              </TradingProvider>
            </AccountProvider>
          </ToastProvider>
        </QueryClientProvider>
      </WagmiProvider>
      </PortalRootContext.Provider>
    </div>
  );
}

export default Terminal;
