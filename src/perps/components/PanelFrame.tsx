import { useState, type ReactNode } from 'react';

/**
 * Card wrapper for a terminal panel. The title bar is the drag handle — dragging
 * it onto another panel swaps the two, exchange-dashboard style. The body is left
 * alone so chart/book interactions never fight the drag.
 */
export function PanelFrame({
  id,
  title,
  actions,
  scroll,
  onSwap,
  children,
}: {
  id: string;
  title: string;
  actions?: ReactNode;
  /** Rail-style panels scroll internally instead of clipping. */
  scroll?: boolean;
  onSwap: (from: string, to: string) => void;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);

  return (
    <section
      className={`panel${over ? ' panel--drop' : ''}`}
      onDragOver={(e) => {
        // Only accept drags carrying one of our panel ids.
        if (!e.dataTransfer.types.includes('application/x-bfi-panel')) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const from = e.dataTransfer.getData('application/x-bfi-panel');
        if (from && from !== id) onSwap(from, id);
      }}
    >
      <header
        className="panel__bar"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-bfi-panel', id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        title="Drag onto another panel to swap"
      >
        <span className="panel__grip" aria-hidden>
          ⠿
        </span>
        <span className="panel__title">{title}</span>
        {actions && <span className="panel__actions">{actions}</span>}
      </header>
      <div className={`panel__body${scroll ? ' panel__body--scroll' : ''}`}>{children}</div>
    </section>
  );
}
