import {
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
  onlyWhenTruncated?: boolean;
  measureTruncationRef?: RefObject<HTMLElement | null>;
}

export function Tooltip({
  content,
  children,
  className,
  onlyWhenTruncated = false,
  measureTruncationRef,
}: TooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});

  const show = () => {
    if (!content.trim()) return;

    const measureEl = measureTruncationRef?.current ?? triggerRef.current;
    if (!measureEl) return;
    if (onlyWhenTruncated && measureEl.scrollWidth <= measureEl.clientWidth) return;

    const rect = measureEl.getBoundingClientRect();
    setStyle({
      position: 'fixed',
      left: rect.left,
      top: rect.bottom + 6,
      maxWidth: Math.min(320, window.innerWidth - rect.left - 16),
    });
    setOpen(true);
  };

  const hide = () => setOpen(false);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={cn('min-w-0', className)}
      >
        {children}
      </div>
      {open &&
        createPortal(
          <div
            role="tooltip"
            style={style}
            className="pointer-events-none z-[100] max-w-xs rounded-md bg-foreground px-3 py-2 text-[12px] font-medium leading-snug text-background shadow-lg"
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
