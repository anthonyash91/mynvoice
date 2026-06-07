import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AppPanel } from '@/components/AppPanel';
import { Sidebar } from '@/components/Sidebar';
import { InvoicePanel } from '@/components/InvoicePanel';
import { EditClientPanel } from '@/components/EditClientPanel';
import { NewClientPanel } from '@/components/NewClientPanel';
import { NewInvoicePanel } from '@/components/NewInvoicePanel';
import { InvoicesView } from '@/views/InvoicesView';
import { ClientsView } from '@/views/ClientsView';
import { SettingsView } from '@/views/SettingsView';
import { LoginView } from '@/views/LoginView';
import { useAuth } from '@/hooks/useAuth';
import { ConfirmProvider } from '@/hooks/useConfirm';
import { useStore } from '@/hooks/useStore';
import { activeViewFromPanel, type Panel, type View } from '@/types';

const PANEL_ANIMATION_MS = 220;

function SetupView() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md text-[13px] space-y-3">
        <h1 className="text-[15px] font-medium">MyNvoice</h1>
        <p className="text-muted-foreground">
          Supabase is not configured. Copy <code className="font-mono">.env.example</code> to{' '}
          <code className="font-mono">.env</code> and add your project URL and anon key.
        </p>
        <p className="text-muted-foreground">
          Then run the SQL in <code className="font-mono">supabase/schema.sql</code> in your
          Supabase dashboard.
        </p>
      </div>
    </div>
  );
}

function AppShell() {
  const { user, signOut } = useAuth();
  const {
    data,
    loading,
    error,
    refresh,
    updateSettings,
    addClient,
    updateClient,
    deleteClient,
    saveInvoiceDraft,
    updateInvoiceStatus,
    deleteInvoice,
    getNextInvoiceNumber,
    getClientInvoiceCount,
  } = useStore(user);

  const [panel, setPanelState] = useState<Panel | null>(null);
  const [panelClosing, setPanelClosing] = useState(false);
  const panelRef = useRef<Panel | null>(null);
  const panelClosingRef = useRef(false);
  const panelCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  panelRef.current = panel;
  panelClosingRef.current = panelClosing;

  useEffect(
    () => () => {
      if (panelCloseTimeoutRef.current) clearTimeout(panelCloseTimeoutRef.current);
    },
    []
  );

  const setPanel = useCallback((next: Panel | null) => {
    if (panelCloseTimeoutRef.current) {
      clearTimeout(panelCloseTimeoutRef.current);
      panelCloseTimeoutRef.current = null;
    }

    if (next === null) {
      if (!panelRef.current || panelClosingRef.current) return;
      setPanelClosing(true);
      panelCloseTimeoutRef.current = setTimeout(() => {
        setPanelState(null);
        setPanelClosing(false);
        panelCloseTimeoutRef.current = null;
      }, PANEL_ANIMATION_MS);
      return;
    }

    setPanelClosing(false);
    setPanelState(next);
  }, []);

  const goto = useCallback((next: View) => {
    if (next === 'invoices') {
      setPanel(null);
    } else if (next === 'clients') {
      setPanel({ kind: 'clients' });
    } else if (next === 'settings') {
      setPanel({ kind: 'settings' });
    }
  }, [setPanel]);

  const openInvoice = useCallback((id: string) => setPanel({ kind: 'invoice', id }), [setPanel]);
  const openClient = useCallback((id: string) => setPanel({ kind: 'edit-client', id }), [setPanel]);
  const openNewClient = useCallback(() => setPanel({ kind: 'new-client' }), [setPanel]);
  const openNewInvoice = useCallback(() => setPanel({ kind: 'new-invoice' }), [setPanel]);

  const panelInvoice =
    panel?.kind === 'invoice' ? data.invoices.find((i) => i.id === panel.id) : undefined;

  const panelClient =
    panel?.kind === 'edit-client'
      ? data.clients.find((c) => c.id === panel.id)
      : undefined;

  const invoiceClient = panelInvoice
    ? data.clients.find((c) => c.id === panelInvoice.clientId) ?? null
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[13px] text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
        <div className="text-[13px] text-destructive max-w-md text-center">{error}</div>
        <button
          onClick={() => refresh()}
          className="h-8 px-3 text-[13px] bg-primary text-primary-foreground rounded hover:opacity-90 font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <ConfirmProvider>
    <div className="flex h-screen w-full bg-background text-foreground">
      <Sidebar
        activeView={activeViewFromPanel(panel)}
        onNavigate={goto}
        onNewInvoice={openNewInvoice}
        onSignOut={signOut}
      />

      <div className="flex-1 relative min-w-0">
        <main className="absolute inset-0 overflow-auto">
          <InvoicesView
            invoices={data.invoices}
            onOpenInvoice={openInvoice}
            onNewInvoice={openNewInvoice}
          />
        </main>

        {panel && (
          <>
            <button
              type="button"
              aria-label="Close panel"
              disabled={panelClosing}
              onClick={() => setPanel(null)}
              className={cn(
                'fixed inset-0 z-[9] bg-foreground/20',
                panelClosing ? 'animate-fade-out' : 'animate-fade-in'
              )}
            />
            <AppPanel closing={panelClosing}>
            {panel.kind === 'clients' && (
              <ClientsView
                clients={data.clients}
                getInvoiceCount={getClientInvoiceCount}
                onOpenClient={openClient}
                onAddClient={openNewClient}
                onDeleteClient={deleteClient}
                onClose={() => setPanel(null)}
              />
            )}
            {panel.kind === 'settings' && (
              <SettingsView
                settings={data.settings}
                onSave={updateSettings}
                onClose={() => setPanel(null)}
              />
            )}
            {panel.kind === 'invoice' && panelInvoice && (
              <InvoicePanel
                invoice={panelInvoice}
                client={invoiceClient}
                settings={data.settings}
                onClose={() => setPanel(null)}
                onMarkSent={() => updateInvoiceStatus(panelInvoice.id, 'sent')}
                onMarkPaid={() => updateInvoiceStatus(panelInvoice.id, 'paid')}
                onDelete={async () => {
                  await deleteInvoice(panelInvoice.id);
                  setPanel(null);
                }}
              />
            )}
            {panel.kind === 'edit-client' && panelClient && (
              <EditClientPanel
                key={panelClient.id}
                client={panelClient}
                onClose={() => setPanel({ kind: 'clients' })}
                onSave={updateClient}
                onDelete={async () => {
                  await deleteClient(panelClient.id);
                  setPanel({ kind: 'clients' });
                }}
              />
            )}
            {panel.kind === 'new-client' && (
              <NewClientPanel
                onClose={() => setPanel({ kind: 'clients' })}
                onSave={addClient}
              />
            )}
            {panel.kind === 'new-invoice' && (
              <NewInvoicePanel
                clients={data.clients}
                settings={data.settings}
                initialNumber={getNextInvoiceNumber()}
                onClose={() => setPanel(null)}
                onSave={async (draft, status) => {
                  const saved = await saveInvoiceDraft(draft, status);
                  setPanel({ kind: 'invoice', id: saved.id });
                }}
              />
            )}
          </AppPanel>
          </>
        )}
      </div>
    </div>
    </ConfirmProvider>
  );
}

export default function App() {
  const { user, loading, signIn, signUp, isConfigured } = useAuth();

  if (!isConfigured) {
    return <SetupView />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[13px] text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <LoginView onSignIn={signIn} onSignUp={signUp} />;
  }

  return <AppShell />;
}
