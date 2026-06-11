import { useState } from 'react';
import { Button } from '@/components/Button';
import { ClientFormFields } from '@/components/ClientFormFields';
import { FormFooter } from '@/components/FormFooter';
import { PanelShell } from '@/components/PanelShell';
import { clientDisplayName, normalizeClientDraft, type ClientDraft } from '@/lib/client';
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
  const [draft, setDraft] = useState<ClientDraft>({
    companyName: client.companyName,
    owner: client.owner,
    primaryEmail: client.primaryEmail,
    hourlyRate: client.hourlyRate,
    additionalEmails: [...client.additionalEmails],
    additionalRates: client.additionalRates.map((r) => ({ ...r })),
    recurringLineItems: client.recurringLineItems.map((item) => ({ ...item })),
    recurringCalendarExclusions: client.recurringCalendarExclusions.map((item) => ({
      ...item,
    })),
    address: client.address,
    reminderIntervalDays: client.reminderIntervalDays,
    lateReminderIntervalDays: client.lateReminderIntervalDays,
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
    <PanelShell title={clientDisplayName(client)} onClose={onClose} fillWidth>
      <div className="flex w-full flex-col gap-4 px-6 pt-5 pb-6">
        <ClientFormFields draft={draft} onChange={setDraft} />
        <FormFooter
          align="between"
          left={
            <Button variant="destructive" onClick={remove} disabled={deleting} loading={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          }
        >
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving} loading={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </FormFooter>
      </div>
    </PanelShell>
  );
}
