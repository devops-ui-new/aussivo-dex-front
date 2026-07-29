import { useWeb3 } from '../../context/Web3Context';

/**
 * The app's wallet, as the terminal sees it.
 *
 * Web3Context is the single source of truth for "who is connected" across
 * Aussivo — the Navbar, the vault flows and the terminal all read this one
 * account. The terminal does not own a connection of its own; see WalletBridge
 * for how wagmi is slaved to it.
 */
export interface AussivoWallet {
  /** Checksummed address, or null when signed out. */
  account: string | null;
  /** Opens the same wallet flow the Navbar's Connect Wallet button uses. */
  connectWallet: () => Promise<string | null>;
  connecting: boolean;
}

export function useAussivoWallet(): AussivoWallet {
  const ctx = useWeb3() as {
    account: string | null;
    connectWallet: () => Promise<string | null>;
  } | null;

  return {
    account: ctx?.account ?? null,
    connectWallet: ctx?.connectWallet ?? (async () => null),
    connecting: false,
  };
}

/**
 * The address the terminal should read and trade for.
 *
 * Deliberately NOT wagmi's `useAccount()`. wagmi persists connections in
 * localStorage (`wagmi.store`) and rehydrates them on mount, so after signing
 * out of Aussivo it still reports the previous address for a while — long
 * enough to fetch and display that wallet's real balances and positions on a
 * page the app considers signed out. Web3Context is the authority on who is
 * signed in; wagmi is only the signing transport, kept in step by WalletBridge.
 */
export function useTerminalAddress(): `0x${string}` | undefined {
  const { account } = useAussivoWallet();
  return account ? (account as `0x${string}`) : undefined;
}
