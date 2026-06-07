import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  clientDisplayName,
  clientInvoiceName,
  clientMatchesQuery,
  clientSecondaryName,
} from '@/lib/client';
import type { Client } from '@/types';

function clientOptionLabel(client: Client) {
  const secondary = clientSecondaryName(client);
  return (
    <>
      {clientDisplayName(client)}
      {secondary && <span className="text-muted-foreground"> · {secondary}</span>}
    </>
  );
}

interface ClientComboboxProps {
  clients: Client[];
  clientId: string;
  clientQuery: string;
  onClientIdChange: (clientId: string) => void;
  onClientQueryChange: (query: string) => void;
  onSelect?: (client: Client) => void;
  placeholder?: string;
}

export function ClientCombobox({
  clients,
  clientId,
  clientQuery,
  onClientIdChange,
  onClientQueryChange,
  onSelect,
  placeholder = 'Search clients…',
}: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);

  const filteredClients = useMemo(() => {
    const sorted = [...clients].sort((a, b) =>
      clientDisplayName(a).localeCompare(clientDisplayName(b))
    );
    if (!clientQuery.trim()) return sorted;
    return sorted.filter((c) => clientMatchesQuery(c, clientQuery));
  }, [clients, clientQuery]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!fieldRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const selectClient = (client: Client) => {
    onClientIdChange(client.id);
    onClientQueryChange(clientInvoiceName(client));
    onSelect?.(client);
    setOpen(false);
  };

  return (
    <div ref={fieldRef} className="relative">
      <div className="relative">
        <input
          value={clientQuery}
          onChange={(e) => {
            onClientQueryChange(e.target.value);
            if (clientId) onClientIdChange('');
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full h-8 pl-3 pr-8 text-[13px] border border-border rounded bg-background outline-none focus:border-primary"
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 border border-border rounded bg-popover overflow-hidden shadow-sm">
          <div className="max-h-48 overflow-y-auto">
            {filteredClients.length === 0 ? (
              <div className="px-3 py-2 text-[13px] text-muted-foreground">No clients found</div>
            ) : (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectClient(client)}
                  className="block w-full text-left px-3 py-1.5 text-[13px] hover:bg-secondary"
                >
                  {clientOptionLabel(client)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
