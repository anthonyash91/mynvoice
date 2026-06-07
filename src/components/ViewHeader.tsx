import type { ReactNode } from 'react';

export function ViewHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="h-14 px-8 border-b border-border flex items-center justify-between">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[15px] font-medium">{title}</h1>
        {subtitle && <span className="text-[13px] text-muted-foreground">{subtitle}</span>}
      </div>
      {action}
    </div>
  );
}
