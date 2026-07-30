import { useEffect, useState } from 'react';
import { useAccount, useBalance, useReadContract, useSwitchChain, useWriteContract } from 'wagmi';
import { useTerminalAddress } from '../lib/aussivoWallet';
import { arbitrum } from 'wagmi/chains';
import { parseUnits } from 'viem';
import {
  BRIDGE_ADDRESS,
  HL_APP_URL,
  MIN_DEPOSIT_USDC,
  USDC_ADDRESS,
  USDC_DECIMALS,
  WITHDRAW_FEE_USDC,
} from '../config';
import { formatUsd } from '../lib/format';
import { useHlAccount } from '../state/account';
import { useTrading } from '../state/trading';
import { useToast } from './Toasts';

export type FundingTab = 'deposit' | 'transfer' | 'withdraw';

const ERC20_TRANSFER = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export function FundingModal({ tab, onClose }: { tab: FundingTab; onClose: () => void }) {
  const [active, setActive] = useState<FundingTab>(tab);
  const [amount, setAmount] = useState('');
  const [dest, setDest] = useState('');
  // chainId still comes from wagmi (it is the live wallet network), but the
  // address is the app's — see useTerminalAddress.
  const { chainId } = useAccount();
  const address = useTerminalAddress();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { clearinghouse, spotUsdc, isUnified } = useHlAccount();
  const trading = useTrading();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const perpsUsdc = Number(clearinghouse?.withdrawable ?? 0);

  // Wallet USDC on Arbitrum — the source for a deposit.
  const { data: walletBal, refetch } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_TRANSFER,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: arbitrum.id,
    // Read on every tab — the wallet balance is context for withdrawals too,
    // and gating it to Deposit left the row showing "—" elsewhere.
    query: { enabled: !!address },
  });
  const walletUsdc = walletBal ? Number(walletBal) / 10 ** USDC_DECIMALS : 0;

  // Gas balance. Holding USDC is not enough — the ERC-20 transfer itself costs
  // ETH on Arbitrum, and the node rejects the tx outright without it.
  const { data: gas } = useBalance({
    address,
    chainId: arbitrum.id,
    query: { enabled: !!address },
  });
  const ethBal = gas ? Number(gas.value) / 1e18 : 0;
  /** Well above a ~0.00002 ETH Arbitrum transfer, but low enough not to nag. */
  const MIN_GAS_ETH = 0.0002;

  useEffect(() => setAmount(''), [active]);
  useEffect(() => setDest(address ?? ''), [address]);

  const num = Number(amount) || 0;
  // On a unified account the spot side is part of the same balance sheet, so it
  // is withdrawable too — reading only `withdrawable` capped withdrawals at ~0.
  const maxWithdraw = perpsUsdc + (isUnified ? spotUsdc : 0);
  const max = active === 'deposit' ? walletUsdc : active === 'withdraw' ? maxWithdraw : spotUsdc;

  // Transfer direction is inferred: whichever side holds the balance.
  const [toPerp, setToPerp] = useState(true);
  const transferMax = toPerp ? spotUsdc : perpsUsdc;

  const validation = (): string | null => {
    if (num <= 0) return 'Enter an amount';
    if (active === 'deposit') {
      if (!BRIDGE_ADDRESS) return 'Native deposit is mainnet-only';
      if (num < MIN_DEPOSIT_USDC) return `Minimum deposit is ${MIN_DEPOSIT_USDC} USDC`;
      if (num > walletUsdc) return 'Exceeds wallet balance';
      // Checked last so the amount errors surface first.
      if (gas && ethBal < MIN_GAS_ETH) return 'Need ETH on Arbitrum for gas';
    }
    // Hyperliquid rejects usdClassTransfer outright on unified accounts.
    if (active === 'transfer' && isUnified) return 'Not needed — account is unified';
    if (active === 'transfer' && num > transferMax) return 'Exceeds available balance';
    if (active === 'withdraw') {
      if (num > maxWithdraw) return 'Exceeds withdrawable balance';
      if (num <= WITHDRAW_FEE_USDC) return `Must exceed the ${formatUsd(WITHDRAW_FEE_USDC)} fee`;
      if (!/^0x[a-fA-F0-9]{40}$/.test(dest)) return 'Enter a valid destination address';
    }
    return null;
  };
  const err = validation();

  const submit = async () => {
    if (err) return;
    setPending(true);
    try {
      if (active === 'deposit') {
        // Plain ERC-20 transfer to Bridge2; validators credit the L1 in ~1 min.
        if (chainId !== arbitrum.id) await switchChainAsync({ chainId: arbitrum.id });
        const hash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_TRANSFER,
          functionName: 'transfer',
          args: [BRIDGE_ADDRESS as `0x${string}`, parseUnits(amount, USDC_DECIMALS)],
          chainId: arbitrum.id,
        });
        toast({
          kind: 'success',
          title: 'Deposit sent',
          detail: `${num} USDC · credited in ~1 min · ${hash.slice(0, 10)}…`,
        });
        void refetch();
        onClose();
      } else if (active === 'transfer') {
        if (await trading.transferUsdClass(num, toPerp)) onClose();
      } else if (await trading.withdraw(dest, num)) {
        onClose();
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      // "insufficient funds" from the node is about gas, not the token being sent —
      // the unmapped message sends people hunting for USDC they already have.
      const gasIssue = /insufficient funds|gas required exceeds/i.test(raw);
      toast({
        kind: 'error',
        title: gasIssue ? 'Not enough ETH for gas' : 'Transaction failed',
        detail: gasIssue
          ? `Your USDC balance is fine — Arbitrum needs a little ETH to pay for the transfer. Bridge or buy ~$1 of ETH on Arbitrum and retry.`
          : raw.slice(0, 200),
      });
    } finally {
      setPending(false);
    }
  };

  const busy = pending || trading.busy;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal fundmodal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Funds</h3>
          <button className="modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="fund__tabs">
          {(['deposit', 'transfer', 'withdraw'] as FundingTab[]).map((t) => (
            <button
              key={t}
              className={`fund__tab${t === active ? ' fund__tab--on' : ''}`}
              onClick={() => setActive(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="fund__bals">
          <div className="kv">
            <span className="dim">Wallet (Arbitrum)</span>
            <span className="num">{formatUsd(walletUsdc)}</span>
          </div>
          {active === 'deposit' && (
            <div className="kv">
              <span className="dim">Gas (ETH on Arbitrum)</span>
              <span className={`num ${ethBal < MIN_GAS_ETH ? 'down' : ''}`}>
                {ethBal.toFixed(5)}
              </span>
            </div>
          )}
          <div className="kv">
            <span className="dim">Spot</span>
            <span className="num">{formatUsd(spotUsdc)}</span>
          </div>
          <div className="kv">
            <span className="dim">Perps (Core)</span>
            <span className="num">{formatUsd(perpsUsdc)}</span>
          </div>
          {active === 'withdraw' && (
            <div className="kv" style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
              <span className="dim">Available to withdraw</span>
              <span className="num">
                {formatUsd(Math.max(0, maxWithdraw - WITHDRAW_FEE_USDC))}
                <span className="dim" style={{ fontSize: 10.5 }}> after fee</span>
              </span>
            </div>
          )}
        </div>

        {active === 'transfer' && isUnified && (
          <div className="fund__note fund__note--info">
            Your account is in <b>unified account</b> mode, so Spot and Perps already share one
            balance — there is nothing to transfer, and Hyperliquid disables the action entirely.
            Your {formatUsd(spotUsdc)} is already available as margin.
          </div>
        )}

        {active === 'transfer' && !isUnified && (
          <div className="fund__dir">
            <button
              className={`fund__dirbtn${toPerp ? ' fund__dirbtn--on' : ''}`}
              onClick={() => setToPerp(true)}
            >
              Spot → Perps
            </button>
            <button
              className={`fund__dirbtn${!toPerp ? ' fund__dirbtn--on' : ''}`}
              onClick={() => setToPerp(false)}
            >
              Perps → Spot
            </button>
          </div>
        )}

        {active === 'withdraw' && (
          <div className="field">
            <span className="field__unit">To</span>
            <input
              value={dest}
              placeholder="0x…"
              onChange={(e) => setDest(e.target.value.trim())}
              style={{ textAlign: 'left', fontSize: 12 }}
            />
          </div>
        )}

        <div
          className="field"
          style={active === 'transfer' && isUnified ? { display: 'none' } : undefined}
        >
          <span className="field__unit">Amount</span>
          <input
            value={amount}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(e) => setAmount(e.target.value)}
            style={{ textAlign: 'left' }}
          />
          <button
            className="fund__max"
            onClick={() =>
              setAmount(String(active === 'transfer' ? transferMax : max > 0 ? max : 0))
            }
          >
            MAX
          </button>
          <span className="field__unit">USDC</span>
        </div>

        <div className="fund__note dim">
          {active === 'deposit' &&
            (BRIDGE_ADDRESS ? (
              <>
                Sends USDC on Arbitrum to Hyperliquid’s Bridge2. Minimum{' '}
                {MIN_DEPOSIT_USDC} USDC — smaller amounts are not credited. Funds land in{' '}
                <b>Perps</b> after ~1 minute. Requires a small amount of <b>ETH on Arbitrum</b>{' '}
                for gas.
              </>
            ) : (
              <>Native deposit is disabled on testnet — use the faucet instead.</>
            ))}
          {active === 'transfer' && !isUnified && (
            <>Moves USDC between your Spot and Perps balances. Free.</>
          )}
          {active === 'withdraw' && (
            <>
              Withdraws from Perps to Arbitrum. Hyperliquid deducts a flat{' '}
              {formatUsd(WITHDRAW_FEE_USDC)} fee; arrival takes ~5 minutes.
            </>
          )}
        </div>

        <button
          className="ticket__cta ticket__cta--connect"
          disabled={!!err || busy}
          style={err || busy ? { opacity: 0.55 } : undefined}
          title={err ?? undefined}
          onClick={() => void submit()}
        >
          {busy
            ? 'Confirm in wallet…'
            : err ??
              (active === 'deposit'
                ? `Deposit ${num || ''} USDC`
                : active === 'transfer'
                  ? `Transfer to ${toPerp ? 'Perps' : 'Spot'}`
                  : `Withdraw ${num || ''} USDC`)}
        </button>

        <button className="fund__ext" onClick={() => window.open(HL_APP_URL, '_blank', 'noopener')}>
          Open Hyperliquid app ↗
        </button>
      </div>
    </div>
  );
}
