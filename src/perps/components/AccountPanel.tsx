import { useState } from 'react';
import { IS_TESTNET, HL_APP_URL } from '../config';
import { formatUsd } from '../lib/format';
import { useHlAccount } from '../state/account';
import { FundingModal, type FundingTab } from './FundingModal';

export function AccountPanel() {
  const { clearinghouse, spotUsdc, isUnified } = useHlAccount();
  const [funding, setFunding] = useState<FundingTab | null>(null);

  const accountValue = Number(clearinghouse?.marginSummary.accountValue ?? 0);
  const marginUsed = Number(clearinghouse?.marginSummary.totalMarginUsed ?? 0);
  const upnl = (clearinghouse?.assetPositions ?? []).reduce(
    (s, p) => s + Number(p.position.unrealizedPnl),
    0,
  );
  // On a unified account there is one balance sheet: the perps side reads 0 until
  // a position exists, so reporting it as the balance contradicts reality.
  const equity = accountValue + (isUnified ? spotUsdc : 0);
  const crossRatio = equity > 0 ? marginUsed / equity : 0;

  return (
    <div className="account">
      <button
        className="btn-soft btn-soft--wide"
        title={
          IS_TESTNET
            ? 'Testnet funds come from the Hyperliquid faucet'
            : 'Deposit USDC from Arbitrum without leaving the app'
        }
        onClick={() =>
          IS_TESTNET
            ? window.open(`${HL_APP_URL}/drip`, '_blank', 'noopener')
            : setFunding('deposit')
        }
      >
        Deposit {IS_TESTNET ? '(faucet)' : ''}
      </button>
      <div className="account__row2">
        <button className="btn-soft" onClick={() => setFunding('transfer')}>
          Perps (Core) ⇆ Spot
        </button>
        <button className="btn-soft" onClick={() => setFunding('withdraw')}>
          Withdraw
        </button>
      </div>

      {/* Bridge deposits land in Spot and can't margin a perp until they're moved —
          except on unified accounts, where the transfer does not exist. */}
      {spotUsdc > 0 && accountValue === 0 && !isUnified && (
        <button className="spot-nudge" onClick={() => setFunding('transfer')}>
          {formatUsd(spotUsdc)} sitting in <b>Spot</b> — transfer to <b>Perps</b> to trade →
        </button>
      )}

      <h4>Account Equity</h4>
      {isUnified ? (
        <>
          <div className="kv">
            <span className="dim">Total (unified)</span>
            <span className="num">{formatUsd(equity)}</span>
          </div>
          <div className="kv kv--sub">
            <span className="dim">· Spot</span>
            <span className="num dim">{formatUsd(spotUsdc)}</span>
          </div>
          <div className="kv kv--sub">
            <span className="dim">· Perps (Core)</span>
            <span className="num dim">{formatUsd(accountValue)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="kv">
            <span className="dim">Spot</span>
            <span className="num">{formatUsd(spotUsdc)}</span>
          </div>
          <div className="kv">
            <span className="dim">Perps (Core)</span>
            <span className="num">{formatUsd(accountValue)}</span>
          </div>
        </>
      )}

      <h4>Perps Overview</h4>
      <div className="kv">
        <span className="dim">{isUnified ? 'Available Margin' : 'Balance'}</span>
        <span className="num">{formatUsd(equity)}</span>
      </div>
      <div className="kv">
        <span className="dim">Unrealized PNL</span>
        <span className={`num ${upnl >= 0 ? 'up' : 'down'}`}>
          {upnl >= 0 ? '+' : '-'}
          {formatUsd(Math.abs(upnl))}
        </span>
      </div>
      <div className="kv">
        <span className="dim">Cross Margin Ratio</span>
        <span className={`num ${crossRatio < 0.5 ? 'up' : 'down'}`}>
          {(crossRatio * 100).toFixed(2)}%
        </span>
      </div>

      {funding && <FundingModal tab={funding} onClose={() => setFunding(null)} />}
    </div>
  );
}
