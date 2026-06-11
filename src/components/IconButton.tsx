import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type IconButtonVariant = 'neutral' | 'destructive' | 'ghost';

const variantClass: Record<IconButtonVariant, string> = {
  neutral: 'text-muted-foreground hover:text-foreground',
  destructive: 'text-muted-foreground hover:text-destructive',
  ghost: 'text-muted-foreground hover:bg-secondary hover:text-foreground',
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  variant?: IconButtonVariant;
  size?: 'sm' | 'md';
  'aria-label': string;
}

export function IconButton({
  icon: Icon,
  variant = 'neutral',
  size = 'sm',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center disabled:opacity-50',
        variant === 'ghost' && 'rounded p-1',
        variant !== 'ghost' && 'px-1',
        variantClass[variant],
        className
      )}
      {...props}
    >
      <Icon className={cn(size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
    </button>
  );
}
