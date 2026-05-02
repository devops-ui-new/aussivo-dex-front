import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import EthereumProvider from "@walletconnect/ethereum-provider";
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
  const [walletType, setWalletType] = useState(null); // injected | walletconnect
  const [wcProvider, setWcProvider] = useState(null);
  const activeProviderRef = useRef(null);
  const wcProviderRef = useRef(null);
  const wcConnectingRef = useRef(false);
  /** When true, WC was created with showQrModal:false — must be recreated before a user-initiated connect. */
  const wcModalDisabledRef = useRef(false);
  /** Addresses we already failed to link (409) — avoids spamming the same toast on re-renders / WC reconnects. */
  const linkWalletConflictRef = useRef(new Set());
  /** True while signing out — avoids WC/MM UI from recursive disconnect + wallet events. */
  const isSigningOutRef = useRef(false);
  const [token, setToken] = useState(() => localStorage.getItem("aussivo_token"));
  const [user, setUser] = useState(null);

  const availableWallets = WALLETS.filter(w => w.check());

  // ── Connect wallet (does NOT authenticate — just exposes signer for on-chain actions) ──
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

  /** Restore injected wallet without eth_requestAccounts (no wallet popup). */
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

  const closeWalletConnectModal = useCallback((wc) => {
    if (!wc) return;
    try {
      wc.modal?.close?.();
    } catch {
      /* ignore */
    }
    window.requestAnimationFrame(() => {
      try {
        wc.modal?.close?.();
      } catch {
        /* ignore */
      }
    });
    window.setTimeout(() => {
      try {
        wc.modal?.close?.();
      } catch {
        /* ignore */
      }
    }, 50);
  }, []);

  const connectWalletConnect = useCallback(async ({ silent = false } = {}) => {
    try {
      if (walletType === "walletconnect" && account && signer) return account;
      if (wcConnectingRef.current) return account || null;
      wcConnectingRef.current = true;

      const projectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "").trim();
      if (!projectId) {
        toast.error("WalletConnect not configured. Set VITE_WALLETCONNECT_PROJECT_ID.");
        wcConnectingRef.current = false;
        return null;
      }

      let wc = wcProviderRef.current || wcProvider;

      if (!silent && wc && wcModalDisabledRef.current) {
        const hasActiveSession = Array.isArray(wc.accounts) && wc.accounts.length > 0;
        if (!hasActiveSession) {
          await wc.disconnect().catch(() => {});
          wcProviderRef.current = null;
          setWcProvider(null);
          wc = null;
          wcModalDisabledRef.current = false;
        }
      }

      if (!wc) {
        wc = await EthereumProvider.init({
          projectId,
          chains: [56, 97],
          showQrModal: !silent,
          methods: ["eth_sendTransaction", "eth_signTransaction", "eth_sign", "personal_sign", "eth_signTypedData", "eth_signTypedData_v4"],
          events: ["chainChanged", "accountsChanged"],
        });
        wcProviderRef.current = wc;
        setWcProvider(wc);
        wcModalDisabledRef.current = silent;
      }

      const hasActiveSession = Array.isArray(wc.accounts) && wc.accounts.length > 0;
      if (!hasActiveSession) {
        if (silent) {
          wcConnectingRef.current = false;
          return null;
        }
        await wc.connect();
        closeWalletConnectModal(wc);
      }

      closeWalletConnectModal(wc);

      const p = new ethers.BrowserProvider(wc);
      const s = await p.getSigner();
      const addr = await s.getAddress();
      const network = await p.getNetwork();
      activeProviderRef.current = wc;
      wcProviderRef.current = wc;
      setWcProvider(wc);
      setWalletProvider(wc);
      setWalletType("walletconnect");
      setProvider(p); setSigner(s); setAccount(addr); setChainId(Number(network.chainId));
      localStorage.setItem("aussivo_wallet", addr);
      localStorage.setItem("aussivo_wallet_type", "walletconnect");
      wcConnectingRef.current = false;
      closeWalletConnectModal(wc);
      return addr;
    } catch (e) {
      wcConnectingRef.current = false;
      console.error("WalletConnect failed:", e);
      const wc = wcProviderRef.current || wcProvider;
      closeWalletConnectModal(wc);
      return null;
    }
  }, [account, signer, walletType, wcProvider, closeWalletConnectModal]);

  const connectWallet = useCallback(async () => {
    if (window.ethereum) return connectInjectedWallet();
    return connectWalletConnect();
  }, [connectInjectedWallet, connectWalletConnect]);

  const disconnect = useCallback(async () => {
    if (isSigningOutRef.current) return;
    isSigningOutRef.current = true;

    try {
      // Drop persisted session first so auto-reconnect cannot run mid teardown.
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

      const activeWc = wcProviderRef.current || wcProvider;
      if (activeWc) {
        try {
          activeWc.modal?.close?.();
        } catch {
          /* ignore */
        }
        if (typeof activeWc.disconnect === "function") {
          await activeWc.disconnect().catch(() => {});
        }
      }
      wcProviderRef.current = null;
      setWcProvider(null);
      wcModalDisabledRef.current = false;
      linkWalletConflictRef.current.clear();

      // Intentionally do NOT call wallet_revokePermissions here — it opens MetaMask /
      // other injected wallets for many users. Clearing app state is enough for sign-out.
    } finally {
      window.setTimeout(() => {
        isSigningOutRef.current = false;
      }, 400);
    }
  }, [wcProvider]);

  /** Tear down browser + WalletConnect session only (keeps email / JWT login). */
  const disconnectWallet = useCallback(async () => {
    if (isSigningOutRef.current) return;
    isSigningOutRef.current = true;
    try {
      localStorage.removeItem("aussivo_wallet");
      localStorage.removeItem("aussivo_wallet_type");

      setAccount(null);
      setSigner(null);
      setProvider(null);
      setChainId(null);
      setWalletProvider(null);
      setWalletType(null);
      activeProviderRef.current = null;

      const activeWc = wcProviderRef.current || wcProvider;
      closeWalletConnectModal(activeWc);
      if (activeWc) {
        try {
          activeWc.modal?.close?.();
        } catch {
          /* ignore */
        }
        if (typeof activeWc.disconnect === "function") {
          await activeWc.disconnect().catch(() => {});
        }
      }
      wcProviderRef.current = null;
      setWcProvider(null);
      wcModalDisabledRef.current = false;
      linkWalletConflictRef.current.clear();
    } finally {
      window.setTimeout(() => {
        isSigningOutRef.current = false;
      }, 400);
    }
  }, [wcProvider, closeWalletConnectModal]);

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

  // ── Auto-reconnect wallet on page load ONLY if the user is still signed in ──
  // (If they signed out, we do a full cold start — no silent wallet pickup.)
  useEffect(() => {
    const saved = localStorage.getItem("aussivo_wallet");
    const existingToken = localStorage.getItem("aussivo_token");
    const savedType = localStorage.getItem("aussivo_wallet_type");
    if (!saved || !existingToken) return;
    // Do not call silent WC again if we're already connected with the same address —
    // a second connectWalletConnect run re-triggers AppKit and leaves the modal open.
    if (savedType === "walletconnect") {
      if (walletType === "walletconnect" && account && saved.toLowerCase() === account.toLowerCase()) {
        return;
      }
      void connectWalletConnect({ silent: true });
    } else if (window.ethereum) {
      void reconnectInjectedWalletSilent(saved);
    }
  }, [connectWalletConnect, reconnectInjectedWalletSilent, walletType, account]);

  // ── Listen for wallet changes ──
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
        } catch {}
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
      } catch {}
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

  // ── Auth helpers ──
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

  // When a logged-in user connects a wallet that isn't yet in their account, link it silently.
  // Any wallet the user ever connects gets appended to walletAddresses so deposits from it
  // are attributed to this email's portfolio.
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
    if (known.has(connected)) return;
    if (linkWalletConflictRef.current.has(connected)) return;

    let cancelled = false;
    linkWallet(connected).then((d) => {
      if (cancelled) return;
      if (d?.status === 200) {
        linkWalletConflictRef.current.delete(connected);
        if (d?.message === "Wallet linked") {
          toast.success(`Linked wallet ${connected.slice(0, 6)}…${connected.slice(-4)}`);
        }
      } else if (d?.status === 409) {
        linkWalletConflictRef.current.add(connected);
        // No toast: WalletConnect often hit false positives; backend now uses DB id for conflict checks.
      }
    });
    return () => {
      cancelled = true;
    };
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
      connectWallet, connectInjectedWallet, connectWalletConnect, disconnect, disconnectWallet, sendOTP, verifyOTP, refreshUser, linkWallet, API,
    }}>
      {children}
    </Web3Ctx.Provider>
  );
}
