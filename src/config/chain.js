// Chain metadata + known contract addresses used across the app for on-chain trust signals.
// All addresses below are REAL, public, verifiable BNB Chain (BSC) mainnet contracts.

export const CHAIN = {
  id: 56,
  name: "BNB Chain",
  short: "BSC",
  symbol: "BNB",
  explorer: "https://bscscan.com",
  // Prefer a configured RPC; fall back to a public BSC endpoint for read-only ticker calls.
  rpc: import.meta.env.VITE_BSC_RPC_URL || "https://bsc-dataseed.binance.org",
};

export const explorerAddress = (addr) => `${CHAIN.explorer}/address/${addr}`;
export const explorerTx = (hash) => `${CHAIN.explorer}/tx/${hash}`;

// Deployed / referenced contracts. Registry comes from env (yours); the stablecoins are the
// canonical BSC token contracts. Entries with an empty `address` are filtered out in the UI.
export const CONTRACTS = [
  {
    label: "Registry (v2)",
    address: import.meta.env.VITE_REGISTRY_V2_ADDRESS || "",
    note: "Public position attestations",
  },
  {
    label: "Registry",
    address: import.meta.env.VITE_REGISTRY_V2_ADDRESS ? "" : (import.meta.env.VITE_REGISTRY_CONTRACT_ADDRESS || ""),
    note: "On-chain wallet registry",
  },
  {
    label: "USDT",
    address: "0x55d398326f99059fF775485246999027B3197955",
    note: "Tether USD (BEP-20)",
  },
  {
    label: "USDC",
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    note: "USD Coin (BEP-20)",
  },
].filter((c) => c.address);

export const shortAddr = (a, s = 6, e = 4) => (a ? `${a.slice(0, s)}…${a.slice(-e)}` : "");