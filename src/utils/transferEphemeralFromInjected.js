import { ethers } from "ethers";

const RPC_BY_CHAIN = {
  56: [
    "https://bsc-rpc.publicnode.com",
    "https://binance.llamarpc.com",
    "https://bsc-dataseed.bnbchain.org",
  ],
  97: [
    "https://bsc-testnet-rpc.publicnode.com",
    "https://bsc-testnet.public.blastapi.io",
    "https://data-seed-prebsc-1-s1.binance.org:8545",
  ],
};

async function getWorkingReadProvider(chainId) {
  const n = Number(chainId);
  const custom = (import.meta.env.VITE_BSC_RPC_URL || "").trim();
  const urls = custom ? [custom] : (RPC_BY_CHAIN[n] || []);
  if (!urls.length) throw new Error("No read RPC for this chain");
  let lastErr;
  for (const url of urls) {
    try {
      const p = new ethers.JsonRpcProvider(url, n, { staticNetwork: true });
      await p.getBlockNumber();
      return p;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function ensureInjectedChain(ethProvider, targetChainId) {
  const hex = "0x" + Number(targetChainId).toString(16);
  const norm = (v) => {
    if (typeof v === "string") return v.toLowerCase();
    if (typeof v === "number") return "0x" + v.toString(16);
    if (typeof v === "bigint") return "0x" + v.toString(16);
    return "";
  };
  const current = await ethProvider.request({ method: "eth_chainId" });
  if (norm(current) === hex.toLowerCase()) return;
  try {
    await ethProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (err) {
    if (err?.code === 4902) {
      const isMainnet = Number(targetChainId) === 56;
      await ethProvider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hex,
          chainName: isMainnet ? "BNB Smart Chain" : "BSC Testnet",
          nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
          rpcUrls: RPC_BY_CHAIN[Number(targetChainId)] || [],
          blockExplorerUrls: [isMainnet ? "https://bscscan.com" : "https://testnet.bscscan.com"],
        }],
      });
    } else throw err;
  }
}

/**
 * ERC-20 transfer from injected wallet to ephemeral deposit address (same as QR flow).
 * @param {object} qrData API deposit/qr payload
 * @param {{ walletType: string | null, connectInjectedWallet: () => Promise<string | null> }} web3
 * @returns {Promise<string>} transaction hash
 */
export async function transferEphemeralFromInjected(qrData, { walletType, connectInjectedWallet }) {
  if (!window.ethereum) {
    throw new Error("No browser wallet. Install MetaMask or another EVM extension.");
  }
  const rawUnits = qrData.amountInBaseUnits != null && String(qrData.amountInBaseUnits).trim() !== ""
    ? String(qrData.amountInBaseUnits).trim()
    : null;
  if (!rawUnits) {
    throw new Error("Missing amount from server. Regenerate the deposit.");
  }

  if (walletType !== "injected") {
    const addr = await connectInjectedWallet();
    if (!addr) throw new Error("Wallet connection cancelled");
  }

  const eth = window.ethereum;
  await ensureInjectedChain(eth, qrData.chainId);
  const browser = new ethers.BrowserProvider(eth);
  const signer = await browser.getSigner();
  const tokenAddr = ethers.getAddress(qrData.tokenAddress);
  const toAddr = ethers.getAddress(qrData.depositAddress);
  const value = BigInt(rawUnits);
  const erc20 = new ethers.Contract(
    tokenAddr,
    ["function transfer(address to, uint256 amount) returns (bool)"],
    signer
  );
  const tx = await erc20.transfer(toAddr, value);
  let readP;
  try {
    readP = await getWorkingReadProvider(qrData.chainId);
  } catch {
    readP = browser;
  }
  await readP.waitForTransaction(tx.hash, 1);
  return tx.hash;
}
