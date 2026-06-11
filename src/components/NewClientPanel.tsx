import { useState } from 'react';
import { Button } from '@/components/Button';
import { ClientFormFields } from '@/components/ClientFormFields';
import { FormFooter } from '@/components/FormFooter';
import { PanelShell } from '@/components/PanelShell';
import { emptyClientDraft, normalizeClientDraft } from '@/lib/client';
import type { Client } from '@/types';

interface NewClientPanelProps {
  onClose: () => void;
  onSave: (client: Omit<Client, 'id'>) => Promise<Client>;
}

export function NewClientPanel({ onClose, onSave }: NewClientPanelProps) {
  const [draft, setDraft] = useState(emptyClientDraft());
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const normalized = normalizeClientDraft(draft);
    if (!normalized.owner && !normalized.companyName) return;
    setSaving(true);
    try {
      await onSave(normalized);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelShell title="New client" onClose={onClose} backArrow fillWidth>
      <div className="flex w-full flex-col gap-4 px-6 pt-5 pb-6">
        <ClientFormFields draft={draft} onChange={setDraft} />
        <FormFooter>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving} loading={saving}>
            {saving ? 'Adding…' : 'Add'}
          </Button>
        </FormFooter>
      </div>
    </PanelShell>
  );
}
