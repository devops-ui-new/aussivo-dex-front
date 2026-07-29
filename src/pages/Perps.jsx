import { Suspense, lazy } from "react";

// The terminal drags in wagmi, viem, the Hyperliquid SDK and lightweight-charts
// (~1MB of JS). Lazy-loading keeps all of it out of the vault/pool bundles that
// most visitors actually land on.
const Terminal = lazy(() => import("../perps/Terminal"));

function TerminalFallback() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted text-sm">
        <div className="pulse-dot" />
        Loading trading terminal…
      </div>
    </div>
  );
}

export default function Perps() {
  return (
    <Suspense fallback={<TerminalFallback />}>
      <Terminal />
    </Suspense>
  );
}
