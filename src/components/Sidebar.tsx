import { FileText, Plus, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { View } from '@/types';

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
  onNewInvoice: () => void;
}

const navItems: { id: View; label: string; icon: typeof FileText }[] = [
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ activeView, onNavigate, onNewInvoice }: SidebarProps) {
  return (
    <nav className="w-[220px] shrink-0 border-r border-border flex flex-col">
      <div className="px-5 h-14 flex items-center border-b border-border">
        <span className="text-[15px] font-medium tracking-tight">MyNvoice</span>
      </div>

      <div className="flex-1 py-3 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-[13px] text-left',
                active
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-border">
        <button
          onClick={onNewInvoice}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-[13px] font-medium rounded px-3 py-2 hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New Invoice
        </button>
      </div>
    </nav>
  );
}
