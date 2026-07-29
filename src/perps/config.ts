// Build-time configuration.
//
// VITE_HL_NETWORK selects the Hyperliquid network for EVERYTHING (market data,
// account state, trading). Dev/staging should run "testnet" (faucet funds, no
// real money); mainnet is the production flip.
export const HL_NETWORK = (import.meta.env.VITE_HL_NETWORK ?? 'mainnet') as 'mainnet' | 'testnet';
export const IS_TESTNET = HL_NETWORK === 'testnet';

const URLS = {
  mainnet: {
    api: 'https://api.hyperliquid.xyz',
    ws: 'wss://api.hyperliquid.xyz/ws',
    app: 'https://app.hyperliquid.xyz',
  },
  testnet: {
    api: 'https://api.hyperliquid-testnet.xyz',
    ws: 'wss://api.hyperliquid-testnet.xyz/ws',
    app: 'https://app.hyperliquid-testnet.xyz',
  },
}[HL_NETWORK];

export const HL_API_URL = import.meta.env.VITE_HL_API_URL ?? URLS.api;
export const HL_WS_URL = import.meta.env.VITE_HL_WS_URL ?? URLS.ws;
/** Hyperliquid's own app — deposit/withdraw/bridge (and faucet on testnet). */
export const HL_APP_URL = URLS.app;

// Builder-code config — attached to every order once the user has approved it.
// Empty address disables the builder fee entirely (orders still work).
export const BUILDER_ADDRESS = (import.meta.env.VITE_HL_BUILDER_ADDRESS ?? '') as string;
/** Tenths of a basis point; 25 = 2.5 bp. Perps cap is 100 (10 bp). */
export const BUILDER_FEE = Number(import.meta.env.VITE_HL_BUILDER_FEE ?? 25);
/** maxFeeRate string for the ApproveBuilderFee action, derived from BUILDER_FEE. */
export const BUILDER_MAX_FEE_RATE = `${(BUILDER_FEE / 1000).toFixed(3)}%`;

export const DEFAULT_COIN = 'BTC';

// ---------- native funding (Arbitrum <-> Hyperliquid) ----------
// Deposits are a plain USDC ERC-20 transfer to Hyperliquid's Bridge2 escrow.
// Mainnet addresses verified on-chain (Bridge2 holds ~$400M USDC).
// Testnet uses a different bridge on Arbitrum Sepolia which we have not verified,
// so native deposit stays disabled there and falls back to the Hyperliquid app.
export const BRIDGE_ADDRESS: `0x${string}` | null = IS_TESTNET
  ? null
  : '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7';
/** Native (not bridged) USDC on Arbitrum One. */
export const USDC_ADDRESS: `0x${string}` = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
export const USDC_DECIMALS = 6;
/** Bridge floor — smaller transfers are not credited and are hard to recover. */
export const MIN_DEPOSIT_USDC = 5;
/** Hyperliquid's flat withdrawal fee, deducted from the amount. */
export const WITHDRAW_FEE_USDC = 1;
