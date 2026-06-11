import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'destructive'
  | 'destructiveFilled'
  | 'outline'
  | 'ghost'
  | 'link';

type ButtonSize = 'sm' | 'md' | 'lg';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90 font-medium',
  secondary: 'hover:bg-secondary',
  destructive: 'text-destructive hover:bg-secondary',
  destructiveFilled: 'bg-destructive text-destructive-foreground hover:opacity-90 font-medium',
  outline: 'border border-border hover:bg-secondary',
  ghost: 'text-muted-foreground hover:bg-secondary hover:text-foreground',
  link: 'text-primary hover:underline',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[13px]',
  md: 'h-8 px-3 text-[13px]',
  lg: 'h-9 px-4 text-[13px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  loadingLabel?: string;
  saved?: boolean;
  savedLabel?: string;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  loadingLabel = 'Saving…',
  saved = false,
  savedLabel = 'Saved',
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const isLink = variant === 'link';
  const showIcon = Icon && !loading && !saved;
  const label = saved ? savedLabel : loading ? loadingLabel : children;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded disabled:opacity-50',
        !isLink && sizeClass[size],
        saved
          ? 'border border-[rgba(52,199,89,0.28)] bg-[rgba(52,199,89,0.1)] text-[#34C759] font-medium hover:opacity-100'
          : variantClass[variant],
        className
      )}
      {...props}
    >
      {showIcon && iconPosition === 'left' && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {label}
      {showIcon && iconPosition === 'right' && <Icon className="h-3.5 w-3.5 shrink-0" />}
    </button>
  );
}
