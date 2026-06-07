import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const SIDEBAR_WIDTH = 220;

function maxPanelWidth() {
  return Math.max(0, window.innerWidth - SIDEBAR_WIDTH);
}

function measureIntrinsicWidth(el: HTMLElement) {
  const prevWidth = el.style.width;
  const prevMinWidth = el.style.minWidth;

  el.style.width = 'max-content';
  el.style.minWidth = 'max-content';
  const width = Math.min(el.scrollWidth, maxPanelWidth());

  el.style.width = prevWidth;
  el.style.minWidth = prevMinWidth;

  return width;
}

export function AppPanel({
  children,
  closing = false,
}: {
  children: ReactNode;
  closing?: boolean;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [canAnimateWidth, setCanAnimateWidth] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setCanAnimateWidth(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    setWidth(measureIntrinsicWidth(el));
  }, [children]);

  useEffect(() => {
    let viewportWidth = window.innerWidth;

    const onResize = () => {
      const nextViewportWidth = window.innerWidth;
      if (nextViewportWidth === viewportWidth) return;
      viewportWidth = nextViewportWidth;

      const el = innerRef.current;
      if (!el) return;
      setWidth(measureIntrinsicWidth(el));
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [children]);

  return (
    <aside
      style={width != null ? { width } : undefined}
      className={cn(
        'fixed top-0 right-0 bottom-0 z-10 flex flex-col max-w-[calc(100vw-220px)] border-l border-border bg-background overflow-x-hidden overflow-y-hidden shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.08)]',
        canAnimateWidth && 'panel-width-transition',
        closing ? 'animate-panel-out' : 'animate-panel-in'
      )}
    >
      <div
        ref={innerRef}
        className="inline-flex flex-col h-full min-h-0 min-w-0 w-max max-w-full"
      >
        {children}
      </div>
    </aside>
  );
}
