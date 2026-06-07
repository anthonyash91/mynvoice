import { useState } from 'react';
import { ClientFormFields } from '@/components/ClientFormFields';
import { PanelShell } from '@/components/PanelShell';
import { clientDisplayName, normalizeClientDraft } from '@/lib/client';
import { useConfirm } from '@/hooks/useConfirm';
import type { Client } from '@/types';

interface EditClientPanelProps {
  client: Client;
  onClose: () => void;
  onSave: (client: Client) => Promise<unknown>;
  onDelete: () => Promise<void>;
}

export function EditClientPanel({ client, onClose, onSave, onDelete }: EditClientPanelProps) {
  const confirm = useConfirm();
  const [draft, setDraft] = useState({
    companyName: client.companyName,
    owner: client.owner,
    primaryEmail: client.primaryEmail,
    hourlyRate: client.hourlyRate,
    additionalEmails: [...client.additionalEmails],
    additionalRates: client.additionalRates.map((r) => ({ ...r })),
    recurringLineItems: client.recurringLineItems.map((item) => ({ ...item })),
    address: client.address,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    const normalized = normalizeClientDraft(draft);
    if (!normalized.owner && !normalized.companyName) return;
    setSaving(true);
    try {
      await onSave({ ...client, ...normalized });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${clientDisplayName(client)}?`,
      description: 'Their invoices will be kept but unlinked.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PanelShell title={clientDisplayName(client)} onClose={onClose}>
      <div className="w-full flex flex-col gap-4 px-6 pt-5 pb-6">
        <ClientFormFields draft={draft} onChange={setDraft} />
        <div className="border-t border-border pt-[22px] flex justify-between gap-2">
          <button
            onClick={remove}
            disabled={deleting}
            className="h-8 px-3 text-[13px] text-destructive rounded hover:bg-secondary disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="h-8 px-3 text-[13px] rounded hover:bg-secondary">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="h-8 px-3 text-[13px] bg-primary text-primary-foreground rounded hover:opacity-90 font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}
