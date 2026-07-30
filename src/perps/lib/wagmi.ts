import { createConfig, http } from 'wagmi';
import { arbitrum, bsc } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// WalletConnect needs a (free) project id from cloud.reown.com; without one we
// still offer injected wallets (MetaMask, Rabby, …).
const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;

/**
 * BSC first, Arbitrum second — deliberately.
 *
 * Aussivo lives on BNB Chain and users should stay there. Arbitrum is only
 * needed at signing time: Hyperliquid actions are EIP-712 typed data carrying
 * Arbitrum's chainId, and wallets refuse to sign typed data whose chainId does
 * not match the active network. So the switch happens inside `getUserWallet()`
 * (trading.tsx) and on deposit — per action, never on page load or connect.
 *
 * BSC must be listed or wagmi treats the user's actual network as unconfigured,
 * which breaks switching back and can throw ChainNotConfiguredError.
 */
export const wagmiConfig = createConfig({
  chains: [bsc, arbitrum],
  transports: {
    [bsc.id]: http(),
    [arbitrum.id]: http(),
  },
  connectors: [
    injected(),
    ...(wcProjectId ? [walletConnect({ projectId: wcProjectId })] : []),
  ],
});
