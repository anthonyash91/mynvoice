import { useCallback, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { InvoicePanel } from '@/components/InvoicePanel';
import { ClientPanel } from '@/components/ClientPanel';
import { NewClientPanel } from '@/components/NewClientPanel';
import { NewInvoicePanel } from '@/components/NewInvoicePanel';
import { InvoicesView } from '@/views/InvoicesView';
import { ClientsView } from '@/views/ClientsView';
import { SettingsView } from '@/views/SettingsView';
import { useStore } from '@/hooks/useStore';
import type { Panel, View } from '@/types';

export default function App() {
  const {
    data,
    updateSettings,
    addClient,
    saveInvoiceDraft,
    updateInvoiceStatus,
    getNextInvoiceNumber,
    getClientInvoiceCount,
  } = useStore();

  const [view, setView] = useState<View>('invoices');
  const [panel, setPanel] = useState<Panel>(null);

  const closePanel = useCallback(() => setPanel(null), []);

  const goto = (v: View) => {
    setPanel(null);
    setView(v);
  };

  const openInvoice = useCallback((id: string) => setPanel({ kind: 'invoice', id }), []);
  const openClient = useCallback((id: string) => setPanel({ kind: 'client', id }), []);
  const openNewClient = useCallback(() => setPanel({ kind: 'new-client' }), []);
  const openNewInvoice = useCallback(() => setPanel({ kind: 'new-invoice' }), []);

  const panelInvoice =
    panel?.kind === 'invoice'
      ? data.invoices.find((i) => i.id === panel.id)
      : undefined;

  const panelClient =
    panel?.kind === 'client' ? data.clients.find((c) => c.id === panel.id) : undefined;

  const invoiceClient = panelInvoice
    ? data.clients.find((c) => c.id === panelInvoice.clientId) ?? null
    : null;

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <Sidebar activeView={view} onNavigate={goto} onNewInvoice={openNewInvoice} />

      <div className="flex-1 relative min-w-0">
        <main className="absolute inset-0 overflow-auto">
          {view === 'invoices' && (
            <InvoicesView
              invoices={data.invoices}
              onOpenInvoice={openInvoice}
              onNewInvoice={openNewInvoice}
            />
          )}
          {view === 'clients' && (
            <ClientsView
              clients={data.clients}
              getInvoiceCount={getClientInvoiceCount}
              onOpenClient={openClient}
              onAddClient={openNewClient}
            />
          )}
          {view === 'settings' && (
            <SettingsView settings={data.settings} onSave={updateSettings} />
          )}
        </main>

        {panel && (
          <aside className="absolute top-0 right-0 bottom-0 w-[480px] border-l border-border bg-background overflow-auto shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.08)] z-10 animate-panel-in">
            {panel.kind === 'invoice' && panelInvoice && (
              <InvoicePanel
                invoice={panelInvoice}
                client={invoiceClient}
                settings={data.settings}
                onClose={closePanel}
                onMarkSent={() => updateInvoiceStatus(panelInvoice.id, 'sent')}
                onMarkPaid={() => updateInvoiceStatus(panelInvoice.id, 'paid')}
              />
            )}
            {panel.kind === 'client' && panelClient && (
              <ClientPanel
                client={panelClient}
                invoices={data.invoices}
                onClose={closePanel}
                onOpenInvoice={(id) => setPanel({ kind: 'invoice', id })}
              />
            )}
            {panel.kind === 'new-client' && (
              <NewClientPanel onClose={closePanel} onSave={addClient} />
            )}
            {panel.kind === 'new-invoice' && (
              <NewInvoicePanel
                clients={data.clients}
                settings={data.settings}
                initialNumber={getNextInvoiceNumber()}
                onClose={closePanel}
                onSave={(draft, status) => {
                  const saved = saveInvoiceDraft(draft, status);
                  setPanel({ kind: 'invoice', id: saved.id });
                }}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
