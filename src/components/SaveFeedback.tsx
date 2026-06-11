import { cn } from '@/lib/utils';

export function SaveFeedback({
  visible,
  message = 'Saved.',
  size = 'md',
  className,
}: {
  visible: boolean;
  message?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (!visible) return null;

  return (
    <span
      className={cn(
        'text-[#34C759]',
        size === 'sm' ? 'text-[12px]' : 'text-[13px]',
        className
      )}
    >
      {message}
    </span>
  );
}
