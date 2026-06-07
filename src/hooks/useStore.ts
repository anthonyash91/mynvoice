import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type {
  AppData,
  CalendarEntry,
  Client,
  Invoice,
  InvoiceDraft,
  Settings,
} from '@/types';
import { resolveSendTemplateKind } from '@/lib/email';
import { resolveStatus } from '@/lib/invoice';
import { clientInvoiceName } from '@/lib/client';
import { monthKeyFromDate } from '@/lib/calendar';
import {
  addClientRecurringCalendarExclusion,
  monthAnchorDate,
  missingRecurringLineItems,
  recurringLineItemToCalendarEntry,
  resolveRecurringLineItemIdForEntry,
} from '@/lib/recurring';
import {
  addGlobalRecurringCalendarExclusion,
  dedupeRecurringCalendarExclusions,
  loadPersistedRecurringExclusions,
  persistRecurringExclusions,
  recurringExclusionsForClient,
} from '@/lib/recurringExclusions';
import {
  deleteCalendarEntryRow,
  markCalendarEntriesBilled,
  unbillCalendarEntriesForInvoice,
  deleteClientRow,
  deleteInvoiceRow,
  ensureInvoicePublicToken,
  fetchAppData,
  insertCalendarEntry,
  updateCalendarEntryRow,
  importLocalData,
  insertClient,
  saveInvoice,
  updateClientRow,
  updateInvoiceStatusRow,
  upsertSettings,
} from '@/lib/database';
import { sendInvoiceWithPdf } from '@/lib/email';
import { migrateEmailTemplates } from '@/lib/emailTemplates';
import { saveEmailTemplatesToStorage } from '@/lib/emailTemplateStorage';
import { loadData } from '@/lib/storage';

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  if (err instanceof Error) return err.message;
  return 'Failed to load data';
}

const emptyData: AppData = {
  clients: [],
  invoices: [],
  calendarEntries: [],
  recurringCalendarExclusions: [],
  settings: {
    businessName: '',
    email: '',
    businessAddress: '',
    mailingAddress: '',
    paymentDetails: '',
    defaultTaxRate: 0,
    defaultDueDays: 14,
    logo: null,
    emailTemplates: migrateEmailTemplates(),
  },
  nextInvoiceNumber: 1,
};

export function useStore(user: User | null) {
  const [data, setData] = useState<AppData>(emptyData);
  const dataRef = useRef(data);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      let appData = await fetchAppData(user.id);

      const hasRemoteData = appData.clients.length > 0 || appData.invoices.length > 0;
      if (!hasRemoteData) {
        const local = loadData();
        const hasLocalData = local.clients.length > 0 || local.invoices.length > 0;
        if (hasLocalData) {
          try {
            appData = await importLocalData(user.id, local);
          } catch (importErr) {
            console.warn('Local data import skipped:', importErr);
          }
        }
      }

      const persistedExclusions = loadPersistedRecurringExclusions(user.id);
      setData({
        ...appData,
        recurringCalendarExclusions: dedupeRecurringCalendarExclusions([
          ...(appData.recurringCalendarExclusions ?? []),
          ...persistedExclusions,
        ]),
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setData(emptyData);
      setLoading(false);
      return;
    }
    refresh();
  }, [user, refresh]);

  const updateSettings = useCallback(
    async (settings: Settings) => {
      if (!user) return;
      const mergedSettings: Settings = {
        ...dataRef.current.settings,
        ...settings,
        emailTemplates: settings.emailTemplates ?? dataRef.current.settings.emailTemplates,
      };
      saveEmailTemplatesToStorage(user.id, mergedSettings.emailTemplates);
      await upsertSettings(user.id, mergedSettings);
      setData((prev) => ({ ...prev, settings: mergedSettings }));
    },
    [user]
  );

  const addClient = useCallback(
    async (client: Omit<Client, 'id'>) => {
      if (!user) throw new Error('Not signed in');
      const created = await insertClient(user.id, client);
      setData((prev) => ({ ...prev, clients: [...prev.clients, created] }));
      return created;
    },
    [user]
  );

  const updateClient = useCallback(
    async (client: Client) => {
      if (!user) throw new Error('Not signed in');
      const updated = await updateClientRow(user.id, client);
      setData((prev) => ({
        ...prev,
        clients: prev.clients.map((c) => (c.id === client.id ? updated : c)),
        invoices: prev.invoices.map((inv) =>
          inv.clientId === client.id
            ? { ...inv, clientName: clientInvoiceName(client) }
            : inv
        ),
      }));
      return updated;
    },
    [user]
  );

  const deleteClient = useCallback(
    async (clientId: string) => {
      if (!user) throw new Error('Not signed in');
      await deleteClientRow(user.id, clientId);
      setData((prev) => ({
        ...prev,
        clients: prev.clients.filter((c) => c.id !== clientId),
        invoices: prev.invoices.map((inv) =>
          inv.clientId === clientId ? { ...inv, clientId: '' } : inv
        ),
        calendarEntries: prev.calendarEntries.filter((entry) => entry.clientId !== clientId),
      }));
    },
    [user]
  );

  const saveInvoiceDraft = useCallback(
    async (draft: InvoiceDraft, status: Invoice['status'] = 'draft') => {
      if (!user) throw new Error('Not signed in');
      const existing = data.invoices.find((inv) => inv.number === draft.number);
      const { invoice, nextInvoiceNumber, newClient } = await saveInvoice(
        user.id,
        draft,
        status,
        existing?.id,
        existing?.createdAt
      );

      const calendarEntryIds = draft.lineItems
        .map((item) => item.sourceCalendarEntryId)
        .filter((id): id is string => Boolean(id));

      let billedEntries: CalendarEntry[] = [];
      if (calendarEntryIds.length > 0) {
        billedEntries = await markCalendarEntriesBilled(
          user.id,
          calendarEntryIds,
          invoice.id
        );
      }

      setData((prev) => {
        const idx = prev.invoices.findIndex((inv) => inv.id === invoice.id);
        const invoices =
          idx >= 0
            ? prev.invoices.map((inv, i) => (i === idx ? invoice : inv))
            : [...prev.invoices, invoice];

        const clients =
          newClient && !prev.clients.some((c) => c.id === newClient.id)
            ? [...prev.clients, newClient]
            : prev.clients;

        const billedById = new Map(billedEntries.map((entry) => [entry.id, entry]));
        const calendarEntries = prev.calendarEntries.map((entry) =>
          billedById.get(entry.id) ?? entry
        );

        return {
          ...prev,
          clients,
          invoices,
          calendarEntries,
          nextInvoiceNumber: idx >= 0 ? prev.nextInvoiceNumber : nextInvoiceNumber,
        };
      });

      return invoice;
    },
    [user, data.invoices]
  );

  const updateInvoiceStatus = useCallback(
    async (invoiceId: string, status: Invoice['status']) => {
      if (!user) throw new Error('Not signed in');
      const updated = await updateInvoiceStatusRow(user.id, invoiceId, status);
      setData((prev) => ({
        ...prev,
        invoices: prev.invoices.map((inv) => (inv.id === invoiceId ? updated : inv)),
      }));
    },
    [user]
  );

  const sendInvoice = useCallback(
    async (
      invoiceId: string,
      pdfBase64: string,
      purpose: 'invoice' | 'reminder' = 'invoice'
    ) => {
      if (!user) throw new Error('Not signed in');

      const snapshot = dataRef.current;
      const invoice = snapshot.invoices.find((inv) => inv.id === invoiceId);
      if (!invoice) throw new Error('Invoice not found');

      const client = snapshot.clients.find((item) => item.id === invoice.clientId);
      if (!client) throw new Error('Link this invoice to a client before sending.');

      const invoiceWithToken = await ensureInvoicePublicToken(user.id, invoiceId);
      const templateKind = resolveSendTemplateKind(resolveStatus(invoiceWithToken), purpose);

      await sendInvoiceWithPdf(
        invoiceWithToken,
        client,
        snapshot.settings,
        pdfBase64,
        templateKind
      );

      setData((prev) => ({
        ...prev,
        invoices: prev.invoices.map((inv) =>
          inv.id === invoiceId ? invoiceWithToken : inv
        ),
      }));

      if (invoiceWithToken.status === 'draft' && purpose === 'invoice') {
        const updated = await updateInvoiceStatusRow(user.id, invoiceId, 'unpaid');
        setData((prev) => ({
          ...prev,
          invoices: prev.invoices.map((inv) => (inv.id === invoiceId ? updated : inv)),
        }));
      }
    },
    [user]
  );

  const deleteInvoice = useCallback(
    async (invoiceId: string) => {
      if (!user) throw new Error('Not signed in');
      const unbilledEntries = await unbillCalendarEntriesForInvoice(user.id, invoiceId);
      await deleteInvoiceRow(user.id, invoiceId);
      setData((prev) => {
        const unbilledById = new Map(unbilledEntries.map((entry) => [entry.id, entry]));
        return {
          ...prev,
          invoices: prev.invoices.filter((inv) => inv.id !== invoiceId),
          calendarEntries: prev.calendarEntries.map((entry) =>
            unbilledById.get(entry.id) ?? entry
          ),
        };
      });
    },
    [user]
  );

  const getClientInvoiceCount = useCallback(
    (clientId: string) => data.invoices.filter((inv) => inv.clientId === clientId).length,
    [data.invoices]
  );

  const addCalendarEntry = useCallback(
    async (entry: Omit<CalendarEntry, 'id'>) => {
      if (!user) throw new Error('Not signed in');
      const created = await insertCalendarEntry(user.id, entry);
      setData((prev) => ({
        ...prev,
        calendarEntries: [...prev.calendarEntries, created].sort((a, b) =>
          a.date.localeCompare(b.date)
        ),
      }));
      return created;
    },
    [user]
  );

  const deleteCalendarEntry = useCallback(
    async (entryId: string) => {
      if (!user) throw new Error('Not signed in');

      const snapshot = dataRef.current;
      const entry = snapshot.calendarEntries.find((item) => item.id === entryId);
      const client = entry
        ? snapshot.clients.find((item) => item.id === entry.clientId)
        : undefined;
      const recurringLineItemId =
        entry && client ? resolveRecurringLineItemIdForEntry(entry, client) : null;
      const monthKey = entry ? monthKeyFromDate(entry.date) : null;

      await deleteCalendarEntryRow(user.id, entryId);

      if (entry && client && recurringLineItemId && monthKey) {
        const updatedClient = {
          ...client,
          recurringCalendarExclusions: addClientRecurringCalendarExclusion(
            client.recurringCalendarExclusions,
            recurringLineItemId,
            monthKey
          ),
        };

        try {
          const saved = await updateClientRow(user.id, updatedClient);
          setData((prev) => {
            const recurringCalendarExclusions = addGlobalRecurringCalendarExclusion(
              prev.recurringCalendarExclusions,
              entry.clientId,
              recurringLineItemId,
              monthKey
            );
            persistRecurringExclusions(user.id, recurringCalendarExclusions);

            return {
              ...prev,
              clients: prev.clients.map((item) =>
                item.id === saved.id
                  ? {
                      ...saved,
                      recurringCalendarExclusions:
                        saved.recurringCalendarExclusions.length > 0
                          ? saved.recurringCalendarExclusions
                          : updatedClient.recurringCalendarExclusions,
                    }
                  : item
              ),
              recurringCalendarExclusions,
              calendarEntries: prev.calendarEntries.filter((item) => item.id !== entryId),
            };
          });
          return;
        } catch (err) {
          console.warn('Failed to persist recurring exclusion to client:', err);
        }
      }

      setData((prev) => {
        if (!entry || !recurringLineItemId || !monthKey) {
          return {
            ...prev,
            calendarEntries: prev.calendarEntries.filter((item) => item.id !== entryId),
          };
        }

        const recurringCalendarExclusions = addGlobalRecurringCalendarExclusion(
          prev.recurringCalendarExclusions,
          entry.clientId,
          recurringLineItemId,
          monthKey
        );
        persistRecurringExclusions(user.id, recurringCalendarExclusions);

        return {
          ...prev,
          recurringCalendarExclusions,
          calendarEntries: prev.calendarEntries.filter((item) => item.id !== entryId),
        };
      });
    },
    [user]
  );

  const updateCalendarEntry = useCallback(
    async (entry: CalendarEntry) => {
      if (!user) throw new Error('Not signed in');
      const updated = await updateCalendarEntryRow(user.id, entry);
      setData((prev) => ({
        ...prev,
        calendarEntries: [...prev.calendarEntries]
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => a.date.localeCompare(b.date)),
      }));
      return updated;
    },
    [user]
  );

  const ensureRecurringCalendarEntriesForMonth = useCallback(
    async (year: number, month: number) => {
      if (!user) return;

      const { clients, invoices, calendarEntries, recurringCalendarExclusions } =
        dataRef.current;
      const anchor = monthAnchorDate(year, month);
      const created: CalendarEntry[] = [];
      let entries = calendarEntries;

      for (const client of clients) {
        const missing = missingRecurringLineItems(
          client.recurringLineItems,
          client.id,
          anchor,
          invoices,
          entries,
          recurringExclusionsForClient(client, recurringCalendarExclusions)
        );

        for (const recurring of missing) {
          const entry = await insertCalendarEntry(
            user.id,
            recurringLineItemToCalendarEntry(recurring, client.id, anchor)
          );
          created.push(entry);
          entries = [...entries, entry];
        }
      }

      if (created.length === 0) return;

      setData((prev) => {
        const existingIds = new Set(prev.calendarEntries.map((item) => item.id));
        const newEntries = created.filter((item) => !existingIds.has(item.id));
        if (newEntries.length === 0) return prev;

        return {
          ...prev,
          calendarEntries: [...prev.calendarEntries, ...newEntries].sort((a, b) =>
            a.date.localeCompare(b.date)
          ),
        };
      });
    },
    [user]
  );

  return {
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
    sendInvoice,
    deleteInvoice,
    getClientInvoiceCount,
    addCalendarEntry,
    updateCalendarEntry,
    deleteCalendarEntry,
    ensureRecurringCalendarEntriesForMonth,
  };
}
