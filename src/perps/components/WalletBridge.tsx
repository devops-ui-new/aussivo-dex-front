import { useEffect, useRef } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useAussivoWallet } from '../lib/aussivoWallet';

/**
 * Keeps wagmi's connection in lockstep with Aussivo's Web3Context.
 *
 * The terminal can't run on an address alone: Hyperliquid actions are signed
 * through `getConnectorClient(wagmiConfig)`, which needs a live wagmi connector.
 * But the user should only ever connect once, from the Navbar. Both stacks talk
 * to the same `window.ethereum`, so once Web3Context has authorised the site we
 * can attach wagmi's injected connector silently — no second popup.
 *
 * Renders nothing; it is pure synchronisation.
 */
export function WalletBridge() {
  const { account } = useAussivoWallet();
  const { address, status } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const inFlight = useRef(false);
  /**
   * The last address we tried to attach to. A wallet holding several accounts
   * can hand wagmi a different one than Web3Context reports; without this the
   * mismatch would re-trigger the effect forever. One attempt per target.
   */
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (inFlight.current) return;
    // wagmi restores prior sessions on mount; acting mid-flight races it.
    if (status === 'connecting' || status === 'reconnecting') return;

    const want = account?.toLowerCase() ?? null;
    const have = address?.toLowerCase() ?? null;
    if (want === have) {
      attempted.current = null; // in sync — allow a future retry
      return;
    }
    if (attempted.current === want) return;

    const connector = connectors.find((c) => c.id === 'injected') ?? connectors[0];
    attempted.current = want;
    inFlight.current = true;

    void (async () => {
      try {
        if (have) await disconnectAsync();
        // Signed out of the app → the terminal follows it out.
        if (want && connector) await connectAsync({ connector });
      } catch (e) {
        // A rejected prompt or a wallet that won't attach silently is not fatal:
        // market data still streams, only signing is unavailable.
        console.warn('[perps] wallet bridge could not attach:', e);
      } finally {
        inFlight.current = false;
      }
    })();
  }, [account, address, status, connectors, connectAsync, disconnectAsync]);

  return null;
}
