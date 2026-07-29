import { useRef } from 'react';

/**
 * Splitter between grid areas. Reports the pointer delta since drag start; the
 * parent decides what that means for the track it owns. Pointer capture keeps
 * the drag alive over iframes/canvases (the chart) once it leaves the handle.
 */
export function Resizer({
  axis,
  area,
  onResize,
}: {
  axis: 'x' | 'y';
  /** grid-area name so the handle lands in the gap track. */
  area: string;
  onResize: (delta: number) => void;
}) {
  const start = useRef(0);
  const dragging = useRef(false);

  return (
    <div
      className={`rz rz--${axis}`}
      style={{ gridArea: area }}
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        start.current = axis === 'x' ? e.clientX : e.clientY;
        dragging.current = true;
        document.body.classList.add(axis === 'x' ? 'resizing-x' : 'resizing-y');
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const pos = axis === 'x' ? e.clientX : e.clientY;
        onResize(pos - start.current);
        start.current = pos;
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        document.body.classList.remove('resizing-x', 'resizing-y');
      }}
    />
  );
}
