import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AppPanel } from '@/components/AppPanel';
import { Button } from '@/components/Button';
import { Sidebar } from '@/components/Sidebar';
import { InvoicePanel } from '@/components/InvoicePanel';
import { EditClientPanel } from '@/components/EditClientPanel';
import { NewClientPanel } from '@/components/NewClientPanel';
import { NewInvoicePanel } from '@/components/NewInvoicePanel';
import { ImportHistoricalInvoicePanel } from '@/components/ImportHistoricalInvoicePanel';
import { InvoicesView } from '@/views/InvoicesView';
import { ClientsView } from '@/views/ClientsView';
import { SettingsView } from '@/views/SettingsView';
import { TemplatesView } from '@/views/TemplatesView';
import { HistoryView } from '@/views/HistoryView';
import { CalendarView } from '@/views/CalendarView';
import { CalendarDayPanel } from '@/components/CalendarDayPanel';
import { LoginView } from '@/views/LoginView';
import { useAuth } from '@/hooks/useAuth';
import { ConfirmProvider } from '@/hooks/useConfirm';
import { useStore } from '@/hooks/useStore';
import { getPublicRoute, PublicInvoiceApp } from '@/views/PublicInvoiceApp';
import { activeViewFromPanel, type Panel, type View } from '@/types';

const PANEL_ANIMATION_MS = 220;

function panelWidthKey(panel: Panel): string {
  if (panel.kind === 'invoice') return `invoice:${panel.id}`;
  if (panel.kind === 'edit-invoice') return `edit-invoice:${panel.id}`;
  if (panel.kind === 'edit-client' || panel.kind === 'new-client') return 'clients';
  if (panel.kind === 'calendar-day') return `calendar-day:${panel.date}`;
  return panel.kind;
}

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
    updateInvoiceDraft,
    updateInvoiceStatus,
    updateInvoiceReminderSettings,
    sendInvoice,
    visitPublicInvoice,
    deleteInvoice,
    importHistoricalInvoice,
    updateHistoricalInvoice,
    bulkImportHistoricalInvoices,
    getClientInvoiceCount,
    addCalendarEntry,
    updateCalendarEntry,
    deleteCalendarEntry,
    ensureRecurringCalendarEntriesForMonth,
  } = useStore(user);

  const [activeView, setActiveView] = useState<View>('invoices');
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
    if (next === 'invoices' || next === 'calendar') {
      setActiveView(next);
      setPanel(null);
      return;
    }

    if (next === 'clients') {
      setPanel({ kind: 'clients' });
    } else if (next === 'history') {
      setPanel({ kind: 'history' });
    } else if (next === 'settings') {
      setPanel({ kind: 'settings' });
    } else if (next === 'templates') {
      setPanel({ kind: 'templates' });
    }
  }, [setPanel]);

  const openInvoice = useCallback((id: string) => setPanel({ kind: 'invoice', id }), [setPanel]);
  const openEditInvoice = useCallback(
    (id: string) => {
      const invoice = data.invoices.find((item) => item.id === id);
      if (invoice?.isHistorical) {
        setPanel({ kind: 'edit-historical', id });
        return;
      }
      setPanel({ kind: 'edit-invoice', id });
    },
    [setPanel, data.invoices]
  );
  const openClient = useCallback((id: string) => setPanel({ kind: 'edit-client', id }), [setPanel]);
  const openNewClient = useCallback(() => setPanel({ kind: 'new-client' }), [setPanel]);
  const openNewInvoice = useCallback(() => setPanel({ kind: 'new-invoice' }), [setPanel]);
  const openImportHistorical = useCallback(
    () => setPanel({ kind: 'import-historical' }),
    [setPanel]
  );

  const panelInvoice =
    panel?.kind === 'invoice' ||
    panel?.kind === 'edit-invoice' ||
    panel?.kind === 'edit-historical'
      ? data.invoices.find((i) => i.id === panel.id)
      : undefined;

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
        <Button variant="primary" onClick={() => refresh()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <ConfirmProvider>
    <div className="flex h-screen w-full bg-background text-foreground">
      <Sidebar
        activeView={panel ? activeViewFromPanel(panel) : activeView}
        onNavigate={goto}
        onNewInvoice={openNewInvoice}
        onSignOut={signOut}
      />

      <div className="flex-1 relative min-w-0">
        <main className="absolute inset-0 overflow-auto">
          {activeView === 'calendar' ? (
            <CalendarView
              entries={data.calendarEntries}
              onOpenDay={(date) => setPanel({ kind: 'calendar-day', date })}
              onEnsureRecurringForMonth={ensureRecurringCalendarEntriesForMonth}
            />
          ) : (
            <InvoicesView
              invoices={data.invoices}
              clients={data.clients}
              settings={data.settings}
              reminderIntervalDays={data.settings.reminderIntervalDays}
              lateReminderIntervalDays={data.settings.lateReminderIntervalDays}
              onOpenInvoice={openInvoice}
              onNewInvoice={openNewInvoice}
              onImportHistorical={openImportHistorical}
              onEditInvoice={openEditInvoice}
              onChangeInvoiceStatus={updateInvoiceStatus}
              onSendInvoice={sendInvoice}
              onVisitPublicInvoice={visitPublicInvoice}
              onDeleteInvoice={async (id) => {
                await deleteInvoice(id);
                if (
                  panel &&
                  (panel.kind === 'invoice' || panel.kind === 'edit-invoice') &&
                  panel.id === id
                ) {
                  setPanel(null);
                }
              }}
            />
          )}
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
            <AppPanel closing={panelClosing} widthKey={panelWidthKey(panel)}>
            {panel.kind === 'calendar-day' && (
              <CalendarDayPanel
                date={panel.date}
                clients={data.clients}
                invoices={data.invoices}
                entries={data.calendarEntries}
                onClose={() => setPanel(null)}
                onAdd={addCalendarEntry}
                onUpdate={updateCalendarEntry}
                onDelete={deleteCalendarEntry}
              />
            )}
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
            {panel.kind === 'history' && (
              <HistoryView
                entries={data.emailHistory}
                onOpenInvoice={(id) => setPanel({ kind: 'invoice', id, from: 'history' })}
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
            {panel.kind === 'templates' && (
              <TemplatesView
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
                onBack={
                  panel.from === 'history' ? () => setPanel({ kind: 'history' }) : undefined
                }
                onEdit={() =>
                  setPanel({
                    kind: 'edit-invoice',
                    id: panelInvoice.id,
                    from: panel.from,
                  })
                }
                onChangeStatus={(status) => updateInvoiceStatus(panelInvoice.id, status)}
                onSendInvoice={(pdfBase64, purpose) =>
                  sendInvoice(panelInvoice.id, pdfBase64, purpose)
                }
                onVisitPublicInvoice={() => visitPublicInvoice(panelInvoice.id)}
                onUpdateReminderSettings={(settings) =>
                  updateInvoiceReminderSettings(panelInvoice.id, settings)
                }
                onDelete={async () => {
                  await deleteInvoice(panelInvoice.id);
                  setPanel(null);
                }}
              />
            )}
            {panel.kind === 'edit-invoice' && panelInvoice && (
              <NewInvoicePanel
                clients={data.clients}
                invoices={data.invoices}
                calendarEntries={data.calendarEntries}
                recurringCalendarExclusions={data.recurringCalendarExclusions}
                settings={data.settings}
                editingInvoice={panelInvoice}
                onClose={() =>
                  setPanel({
                    kind: 'invoice',
                    id: panelInvoice.id,
                    from: panel.from,
                  })
                }
                onSave={async () => {}}
                onUpdate={async (draft) => {
                  await updateInvoiceDraft(panelInvoice.id, draft);
                  setPanel({
                    kind: 'invoice',
                    id: panelInvoice.id,
                    from: panel.from,
                  });
                }}
                onAddCalendarEntry={addCalendarEntry}
                onUpdateCalendarEntry={updateCalendarEntry}
                onDeleteCalendarEntry={deleteCalendarEntry}
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
                invoices={data.invoices}
                calendarEntries={data.calendarEntries}
                recurringCalendarExclusions={data.recurringCalendarExclusions}
                settings={data.settings}
                onClose={() => setPanel(null)}
                onSave={async (draft, status) => {
                  const saved = await saveInvoiceDraft(draft, status);
                  setPanel({ kind: 'invoice', id: saved.id });
                }}
                onAddCalendarEntry={addCalendarEntry}
                onUpdateCalendarEntry={updateCalendarEntry}
                onDeleteCalendarEntry={deleteCalendarEntry}
              />
            )}
            {panel.kind === 'import-historical' && (
              <ImportHistoricalInvoicePanel
                clients={data.clients}
                onClose={() => setPanel(null)}
                onImport={async (input) => {
                  const saved = await importHistoricalInvoice(input);
                  setPanel({ kind: 'invoice', id: saved.id });
                  return saved;
                }}
                onBulkImport={bulkImportHistoricalInvoices}
              />
            )}
            {panel.kind === 'edit-historical' && panelInvoice && (
              <ImportHistoricalInvoicePanel
                clients={data.clients}
                editingInvoice={panelInvoice}
                onClose={() => setPanel({ kind: 'invoice', id: panelInvoice.id })}
                onImport={importHistoricalInvoice}
                onUpdate={async (invoiceId, input) => {
                  const saved = await updateHistoricalInvoice(invoiceId, input);
                  setPanel({ kind: 'invoice', id: saved.id });
                  return saved;
                }}
                onBulkImport={bulkImportHistoricalInvoices}
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

function AuthenticatedApp() {
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

export default function App() {
  const publicRoute = getPublicRoute();
  if (publicRoute) {
    return <PublicInvoiceApp route={publicRoute} />;
  }

  return <AuthenticatedApp />;
}
