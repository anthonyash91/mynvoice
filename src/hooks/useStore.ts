import { useCallback, useEffect, useState } from 'react';
import type { AppData, Client, Invoice, InvoiceDraft, Settings } from '../types';
import { formatInvoiceNumber } from '../lib/invoice';
import { loadData, saveData } from '../lib/storage';

function generateId(): string {
  return crypto.randomUUID();
}

export function useStore() {
  const [data, setData] = useState<AppData>(() => loadData());

  useEffect(() => {
    saveData(data);
  }, [data]);

  const updateSettings = useCallback((settings: Settings) => {
    setData((prev) => ({ ...prev, settings }));
  }, []);

  const addClient = useCallback((client: Omit<Client, 'id'>) => {
    const newClient: Client = { ...client, id: generateId() };
    setData((prev) => ({ ...prev, clients: [...prev.clients, newClient] }));
    return newClient;
  }, []);

  const updateClient = useCallback((client: Client) => {
    setData((prev) => ({
      ...prev,
      clients: prev.clients.map((c) => (c.id === client.id ? client : c)),
      invoices: prev.invoices.map((inv) =>
        inv.clientId === client.id ? { ...inv, clientName: client.name } : inv
      ),
    }));
  }, []);

  const saveInvoiceDraft = useCallback(
    (draft: InvoiceDraft, status: Invoice['status'] = 'draft'): Invoice => {
      let savedInvoice!: Invoice;
      setData((prev) => {
        let clients = prev.clients;
        let clientId = draft.clientId;

        if (!clientId && draft.clientName) {
          const existing = prev.clients.find(
            (c) => c.name.toLowerCase() === draft.clientName.toLowerCase()
          );
          if (existing) {
            clientId = existing.id;
          } else {
            const newClient: Client = {
              id: generateId(),
              name: draft.clientName,
              company: '',
              email: '',
            };
            clientId = newClient.id;
            clients = [...prev.clients, newClient];
          }
        }

        const existingIdx = prev.invoices.findIndex((inv) => inv.number === draft.number);
        savedInvoice = {
          id: existingIdx >= 0 ? prev.invoices[existingIdx].id : generateId(),
          clientId,
          clientName: draft.clientName,
          number: draft.number,
          issueDate: draft.issueDate,
          dueDate: draft.dueDate,
          lineItems: draft.lineItems,
          notes: draft.notes,
          taxEnabled: draft.taxEnabled,
          taxRate: draft.taxRate,
          status,
          createdAt:
            existingIdx >= 0
              ? prev.invoices[existingIdx].createdAt
              : new Date().toISOString().split('T')[0],
        };

        const invoices =
          existingIdx >= 0
            ? prev.invoices.map((inv, i) => (i === existingIdx ? savedInvoice : inv))
            : [...prev.invoices, savedInvoice];

        const nextInvoiceNumber =
          existingIdx >= 0 ? prev.nextInvoiceNumber : prev.nextInvoiceNumber + 1;

        return { ...prev, clients, invoices, nextInvoiceNumber };
      });
      return savedInvoice;
    },
    []
  );

  const updateInvoiceStatus = useCallback((invoiceId: string, status: Invoice['status']) => {
    setData((prev) => ({
      ...prev,
      invoices: prev.invoices.map((inv) =>
        inv.id === invoiceId ? { ...inv, status } : inv
      ),
    }));
  }, []);

  const getNextInvoiceNumber = useCallback(() => {
    return formatInvoiceNumber(data.nextInvoiceNumber);
  }, [data.nextInvoiceNumber]);

  const getClientInvoiceCount = useCallback(
    (clientId: string) => data.invoices.filter((inv) => inv.clientId === clientId).length,
    [data.invoices]
  );

  return {
    data,
    updateSettings,
    addClient,
    updateClient,
    saveInvoiceDraft,
    updateInvoiceStatus,
    getNextInvoiceNumber,
    getClientInvoiceCount,
  };
}
