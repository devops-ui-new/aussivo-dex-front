import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";

const Web3Ctx = createContext(null);
export const useWeb3 = () => useContext(Web3Ctx);

import { API } from "../config/api";

const WALLETS = [
  { id: "metamask", name: "MetaMask", icon: "🦊", check: () => window.ethereum?.isMetaMask },
  { id: "coinbase", name: "Coinbase Wallet", icon: "🔵", check: () => window.ethereum?.isCoinbaseWallet },
  { id: "trust", name: "Trust Wallet", icon: "🛡️", check: () => window.ethereum?.isTrust },
  { id: "injected", name: "Browser Wallet", icon: "🌐", check: () => !!window.ethereum },
];

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("aussivo_token"));
  const [user, setUser] = useState(null);
  const [needsRegistration, setNeedsRegistration] = useState(false);

  const availableWallets = WALLETS.filter(w => w.check());

  // ── Connect wallet + auto-login if returning user ──
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) return null;
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      const accounts = await p.send("eth_requestAccounts", []);
      const s = await p.getSigner();
      const network = await p.getNetwork();
      setProvider(p); setSigner(s); setAccount(accounts[0]); setChainId(Number(network.chainId));
      localStorage.setItem("aussivo_wallet", accounts[0]);

      // If already have valid token, skip auth
      if (localStorage.getItem("aussivo_token")) return accounts[0];

      // Try instant wallet auth (returning user = no OTP needed)
      const res = await fetch(`${API}/api/user/wallet-auth`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: accounts[0] }),
      });
      const data = await res.json();

      if (data.data?.registered && data.data?.token) {
        // Returning user — auto-logged in instantly
        setToken(data.data.token);
        setUser(data.data.user);
        localStorage.setItem("aussivo_token", data.data.token);
        setNeedsRegistration(false);
        toast.success(`Welcome back, ${data.data.user.name || ""}!`);
      } else {
        // New user — needs registration
        setNeedsRegistration(true);
      }

      return accounts[0];
    } catch (e) { console.error("Connect failed:", e); return null; }
  }, []);

  const disconnect = () => {
    setAccount(null); setSigner(null); setProvider(null);
    setToken(null); setUser(null); setNeedsRegistration(false);
    localStorage.removeItem("aussivo_token"); localStorage.removeItem("aussivo_wallet");
  };

  // ── Validate existing token on page load ──
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/user/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.status === 200) setUser(d.data);
        else { setToken(null); setUser(null); localStorage.removeItem("aussivo_token"); }
      })
      .catch(() => {});
  }, [token]);

  // ── Auto-reconnect wallet on page load ──
  useEffect(() => {
    const saved = localStorage.getItem("aussivo_wallet");
    if (saved && window.ethereum) connectWallet();
  }, [connectWallet]);

  // ── Listen for wallet changes ──
  useEffect(() => {
    if (!window.ethereum) return;
    const onChange = (accts) => { if (accts.length === 0) disconnect(); else setAccount(accts[0]); };
    window.ethereum.on("accountsChanged", onChange);
    window.ethereum.on("chainChanged", () => window.location.reload());
    return () => { window.ethereum.removeListener("accountsChanged", onChange); };
  }, []);

  // ── Auth helpers (for registration only) ──
  const sendOTP = async (email, name, referralCode) => {
    const res = await fetch(`${API}/api/user/send-otp`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, walletAddress: account || `email_${Date.now()}`, name, referralCode }),
    });
    return res.json();
  };

  const verifyOTP = async (email, otp) => {
    const res = await fetch(`${API}/api/user/verify-otp`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (data.status === 200 && data.data?.token) {
      setToken(data.data.token); setUser(data.data.user);
      localStorage.setItem("aussivo_token", data.data.token);
      setNeedsRegistration(false);
    }
    return data;
  };

  const refreshUser = async () => {
    if (!token) return;
    const res = await fetch(`${API}/api/user/me`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await res.json();
    if (d.status === 200) setUser(d.data);
  };

  const linkWallet = async (walletAddress) => {
    if (!token || !walletAddress) return null;
    const res = await fetch(`${API}/api/user/link-wallet`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ walletAddress }),
    });
    const d = await res.json();
    if (d.status === 200) { await refreshUser(); }
    return d;
  };

  // When a logged-in user has a different wallet connected than the one on their record,
  // auto-sync so on-chain deposits route to the right account.
  useEffect(() => {
    if (!token || !user || !account) return;
    const registered = (user.walletAddress || "").toLowerCase();
    const connected = account.toLowerCase();
    if (!connected || connected === registered) return;
    if (registered && !registered.startsWith("0x")) {
      // Registered value is a placeholder like "email_…" — silently upgrade it
      linkWallet(connected);
    } else {
      linkWallet(connected).then(d => {
        if (d?.status === 200) toast.success(`Wallet updated to ${connected.slice(0, 6)}…${connected.slice(-4)}`);
        else if (d?.status === 409) toast.error("This wallet is already linked to another account");
      });
    }
  }, [token, user?.walletAddress, account]);

  const isLoggedIn = !!(token && user);
  const short = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "";

  return (
    <Web3Ctx.Provider value={{
      account, provider, signer, chainId, token, user, short, availableWallets,
      isLoggedIn, needsRegistration,
      connectWallet, disconnect, sendOTP, verifyOTP, refreshUser, linkWallet, API,
    }}>
      {children}
    </Web3Ctx.Provider>
  );
}
