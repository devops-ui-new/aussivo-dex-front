import { useEffect, useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { arbitrum } from 'wagmi/chains';
import { useAussivoWallet } from '../lib/aussivoWallet';
import { useToast } from './Toasts';

/** Dismissed for this tab only — a reload should ask again. */
const DISMISS_KEY = 'perps.networkPrompt.dismissed';

/**
 * Offers to move the wallet to Arbitrum on arrival at the trading page.
 *
 * Hyperliquid actions are EIP-712 typed data carrying Arbitrum's chainId, and
 * wallets refuse to sign typed data whose chainId does not match the active
 * network. Trading still works without accepting — `getUserWallet()` switches
 * on demand — but doing it up front means the first order is one signature
 * instead of a network prompt followed by a signature.
 *
 * Offered, never forced: Aussivo's vault pages live on BNB Chain, so the user
 * is only asked once per tab and can decline.
 */
export function NetworkPrompt() {
  const { account } = useAussivoWallet();
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const wrongChain = !!account && !!chainId && chainId !== arbitrum.id;

  useEffect(() => {
    if (!wrongChain) return;
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    setOpen(true);
  }, [wrongChain]);

  // Chain changed (here or in the wallet) — nothing left to ask.
  useEffect(() => {
    if (!wrongChain) setOpen(false);
  }, [wrongChain]);

  if (!open || !wrongChain) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setOpen(false);
  };

  const doSwitch = async () => {
    setBusy(true);
    try {
      await switchChainAsync({ chainId: arbitrum.id });
      setOpen(false);
    } catch {
      // Declined in the wallet, or the wallet cannot switch. Not fatal — the
      // per-action switch will ask again when it actually matters.
      toast({
        kind: 'error',
        title: 'Network not switched',
        detail: 'You can still trade — you will be asked again when you place an order.',
      });
      dismiss();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={dismiss}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Switch to Arbitrum?</h3>
          <button className="modal__close" onClick={dismiss}>
            ✕
          </button>
        </div>

        <div className="modal__note">
          Perpetuals settle on Hyperliquid, which signs on <b>Arbitrum</b>. Your wallet is on
          another network right now.
          <br />
          <br />
          Switching now means placing an order takes a single signature. You can skip this — we
          will ask again at the moment you trade. Aussivo&apos;s vaults stay on BNB Chain either
          way.
        </div>

        <button
          className="ticket__cta ticket__cta--connect"
          style={{ marginTop: 14, opacity: busy ? 0.55 : 1 }}
          disabled={busy}
          onClick={() => void doSwitch()}
        >
          {busy ? 'Waiting for wallet…' : 'Switch to Arbitrum'}
        </button>
        <button
          className="btn-soft"
          style={{ width: '100%', marginTop: 8, padding: '9px 0' }}
          onClick={dismiss}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
