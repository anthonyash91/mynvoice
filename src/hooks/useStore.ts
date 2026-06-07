import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppData, Client, Invoice, InvoiceDraft, Settings } from '@/types';
import { clientInvoiceName } from '@/lib/client';
import { formatInvoiceNumber } from '@/lib/invoice';
import {
  deleteClientRow,
  deleteInvoiceRow,
  fetchAppData,
  importLocalData,
  insertClient,
  saveInvoice,
  updateClientRow,
  updateInvoiceStatusRow,
  upsertSettings,
} from '@/lib/database';
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
  settings: {
    businessName: '',
    email: '',
    businessAddress: '',
    mailingAddress: '',
    paymentDetails: '',
    defaultTaxRate: 0,
    logo: null,
  },
  nextInvoiceNumber: 1,
};

export function useStore(user: User | null) {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);

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

      setData(appData);
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
      await upsertSettings(user.id, settings);
      setData((prev) => ({ ...prev, settings }));
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

        return {
          ...prev,
          clients,
          invoices,
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

  const deleteInvoice = useCallback(
    async (invoiceId: string) => {
      if (!user) throw new Error('Not signed in');
      await deleteInvoiceRow(user.id, invoiceId);
      setData((prev) => ({
        ...prev,
        invoices: prev.invoices.filter((inv) => inv.id !== invoiceId),
      }));
    },
    [user]
  );

  const getNextInvoiceNumber = useCallback(() => {
    return formatInvoiceNumber(data.nextInvoiceNumber);
  }, [data.nextInvoiceNumber]);

  const getClientInvoiceCount = useCallback(
    (clientId: string) => data.invoices.filter((inv) => inv.clientId === clientId).length,
    [data.invoices]
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
    deleteInvoice,
    getNextInvoiceNumber,
    getClientInvoiceCount,
  };
}
