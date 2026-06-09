import { useState } from 'react';
import { ClientFormFields } from '@/components/ClientFormFields';
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
      <div className="w-full flex flex-col gap-4 px-6 pt-5 pb-6">
        <ClientFormFields draft={draft} onChange={setDraft} />
        <div className="border-t border-border pt-[22px] flex justify-end gap-2">
          <button onClick={onClose} className="h-8 px-3 text-[13px] rounded hover:bg-secondary">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="h-8 px-3 text-[13px] bg-primary text-primary-foreground rounded hover:opacity-90 font-medium disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </PanelShell>
  );
}
