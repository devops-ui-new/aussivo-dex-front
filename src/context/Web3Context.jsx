import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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
  const [walletProvider, setWalletProvider] = useState(null);
  const [walletType, setWalletType] = useState(null); // injected only
  const activeProviderRef = useRef(null);
  const linkWalletConflictRef = useRef(new Set());
  const linkWalletPendingRef = useRef(new Set());
  const isSigningOutRef = useRef(false);
  const [token, setToken] = useState(() => localStorage.getItem("aussivo_token"));
  const [user, setUser] = useState(null);

  const availableWallets = WALLETS.filter(w => w.check());

  const connectInjectedWallet = useCallback(async () => {
    if (!window.ethereum) return null;
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      const accounts = await p.send("eth_requestAccounts", []);
      const s = await p.getSigner();
      const network = await p.getNetwork();
      activeProviderRef.current = window.ethereum;
      setWalletProvider(window.ethereum);
      setWalletType("injected");
      setProvider(p); setSigner(s); setAccount(accounts[0]); setChainId(Number(network.chainId));
      localStorage.setItem("aussivo_wallet", accounts[0]);
      localStorage.setItem("aussivo_wallet_type", "injected");
      return accounts[0];
    } catch (e) { console.error("Connect failed:", e); return null; }
  }, []);

  const reconnectInjectedWalletSilent = useCallback(async (savedAddr) => {
    if (!window.ethereum) return null;
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (!accounts?.length) return null;
      const addr = accounts[0];
      if (savedAddr && addr.toLowerCase() !== String(savedAddr).toLowerCase()) {
        localStorage.setItem("aussivo_wallet", addr);
      }
      const p = new ethers.BrowserProvider(window.ethereum);
      const s = await p.getSigner();
      const network = await p.getNetwork();
      activeProviderRef.current = window.ethereum;
      setWalletProvider(window.ethereum);
      setWalletType("injected");
      setProvider(p); setSigner(s); setAccount(addr); setChainId(Number(network.chainId));
      return addr;
    } catch (e) {
      console.error("Silent reconnect failed:", e);
      return null;
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      toast.error("Install a browser wallet (e.g. MetaMask) to connect.");
      return null;
    }
    return connectInjectedWallet();
  }, [connectInjectedWallet]);

  const disconnect = useCallback(async () => {
    if (isSigningOutRef.current) return;
    isSigningOutRef.current = true;

    try {
      localStorage.removeItem("aussivo_token");
      localStorage.removeItem("aussivo_wallet");
      localStorage.removeItem("aussivo_wallet_type");

      setToken(null);
      setUser(null);
      setAccount(null);
      setSigner(null);
      setProvider(null);
      setChainId(null);
      setWalletProvider(null);
      setWalletType(null);
      activeProviderRef.current = null;
      linkWalletConflictRef.current.clear();
    } finally {
      window.setTimeout(() => {
        isSigningOutRef.current = false;
      }, 400);
    }
  }, []);

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

  useEffect(() => {
    const saved = localStorage.getItem("aussivo_wallet");
    const existingToken = localStorage.getItem("aussivo_token");
    const savedType = localStorage.getItem("aussivo_wallet_type");
    if (!saved || !existingToken) return;
    if (savedType === "walletconnect") {
      localStorage.removeItem("aussivo_wallet");
      localStorage.removeItem("aussivo_wallet_type");
      return;
    }
    if (window.ethereum) void reconnectInjectedWalletSilent(saved);
  }, [reconnectInjectedWalletSilent]);

  useEffect(() => {
    const p = walletProvider || window.ethereum;
    if (!p || typeof p.on !== "function") return;
    const onAccountsChanged = async (accts) => {
      if (isSigningOutRef.current) return;
      if (!accts || accts.length === 0) void disconnect();
      else {
        setAccount(accts[0]);
        try {
          const bp = new ethers.BrowserProvider(p);
          const s = await bp.getSigner();
          const n = await bp.getNetwork();
          setProvider(bp);
          setSigner(s);
          setChainId(Number(n.chainId));
        } catch { /* ignore */ }
      }
    };
    const onChainChanged = async () => {
      if (isSigningOutRef.current) return;
      try {
        const bp = new ethers.BrowserProvider(p);
        const s = await bp.getSigner();
        const n = await bp.getNetwork();
        setProvider(bp);
        setSigner(s);
        setChainId(Number(n.chainId));
      } catch { /* ignore */ }
    };
    p.on("accountsChanged", onAccountsChanged);
    p.on("chainChanged", onChainChanged);
    return () => {
      if (typeof p.removeListener === "function") {
        p.removeListener("accountsChanged", onAccountsChanged);
        p.removeListener("chainChanged", onChainChanged);
      }
    };
  }, [walletProvider, disconnect]);

  const sendOTP = async (email, name, referralCode) => {
    const res = await fetch(`${API}/api/user/send-otp`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, walletAddress: account || undefined, name, referralCode }),
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

  const linkWalletRef = useRef(linkWallet);
  linkWalletRef.current = linkWallet;
  const userRef = useRef(user);
  const tokenRef = useRef(token);
  const accountRef = useRef(account);
  userRef.current = user;
  tokenRef.current = token;
  accountRef.current = account;

  useEffect(() => {
    if (!token || !user || !account) return;
    let connected;
    try {
      connected = ethers.getAddress(account).toLowerCase();
    } catch {
      return;
    }
    const known = new Set(
      [
        ...(user.walletAddresses || []).map((w) => (w || "").trim().toLowerCase()).filter(Boolean),
        (user.walletAddress || "").trim().toLowerCase(),
      ].filter(Boolean),
    );
    if (known.has(connected)) {
      linkWalletConflictRef.current.delete(connected);
      return;
    }
    if (linkWalletConflictRef.current.has(connected)) return;
    if (linkWalletPendingRef.current.has(connected)) return;

    let cancelled = false;

    const runLink = () => {
      if (cancelled) return;
      const t = tokenRef.current;
      const u = userRef.current;
      const addrRaw = accountRef.current;
      if (!t || !u || !addrRaw) return;
      let connectedNow;
      try {
        connectedNow = ethers.getAddress(addrRaw).toLowerCase();
      } catch {
        return;
      }
      const knownNow = new Set(
        [
          ...(u.walletAddresses || []).map((w) => (w || "").trim().toLowerCase()).filter(Boolean),
          (u.walletAddress || "").trim().toLowerCase(),
        ].filter(Boolean),
      );
      if (knownNow.has(connectedNow)) {
        linkWalletConflictRef.current.delete(connectedNow);
        return;
      }
      if (linkWalletConflictRef.current.has(connectedNow)) return;
      if (linkWalletPendingRef.current.has(connectedNow)) return;

      linkWalletPendingRef.current.add(connectedNow);
      linkWalletRef.current(connectedNow)
        .then((d) => {
          if (cancelled) return;
          if (d?.status === 200) {
            linkWalletConflictRef.current.delete(connectedNow);
            if (d?.message === "Wallet linked") {
              toast.success(`Linked wallet ${connectedNow.slice(0, 6)}…${connectedNow.slice(-4)}`);
            }
          } else if (d?.status === 409) {
            linkWalletConflictRef.current.add(connectedNow);
            const tok = tokenRef.current;
            if (tok) {
              fetch(`${API}/api/user/me`, { headers: { Authorization: `Bearer ${tok}` } })
                .then((r) => r.json())
                .then((d2) => {
                  if (d2.status === 200) setUser(d2.data);
                })
                .catch(() => {});
            }
          }
        })
        .finally(() => {
          linkWalletPendingRef.current.delete(connectedNow);
        });
    };

    runLink();
    return () => { cancelled = true; };
  }, [token, user?.walletAddresses, user?.walletAddress, account]);

  const isLoggedIn = !!(token && user);
  const short = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "";
  const getActiveProvider = () => activeProviderRef.current || walletProvider || window.ethereum || null;

  return (
    <Web3Ctx.Provider value={{
      account, provider, signer, chainId, token, user, short, availableWallets,
      walletProvider, walletType,
      isLoggedIn,
      getActiveProvider,
      connectWallet, connectInjectedWallet, disconnect, sendOTP, verifyOTP, refreshUser, linkWallet, API,
      contracts: null,
      config: null,
    }}>
      {children}
    </Web3Ctx.Provider>
  );
}
