export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-surface-3/40 mt-20">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-brand/10 border border-brand/20 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
              </svg>
            </div>
            <span className="font-display font-semibold text-sm">Aussivo<span className="text-brand">.DEX</span></span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted">
            <span>Transparent</span>
            <span className="w-1 h-1 rounded-full bg-surface-4" />
            <span>Permissionless</span>
            <span className="w-1 h-1 rounded-full bg-surface-4" />
            <span>Non-Custodial</span>
          </div>
          <div className="text-xs text-muted">&copy; {new Date().getFullYear()} Aussivo.DEX Protocol</div>
        </div>
      </div>
    </footer>
  );
}
