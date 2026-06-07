import { useState } from 'react';
import { Field } from '@/components/Field';
import { PanelShell } from '@/components/PanelShell';
import { TextInput } from '@/components/TextInput';
import type { Client } from '@/types';

interface NewClientPanelProps {
  onClose: () => void;
  onSave: (client: Omit<Client, 'id'>) => void;
}

export function NewClientPanel({ onClose, onSave }: NewClientPanelProps) {
  const [draft, setDraft] = useState({ name: '', company: '', email: '' });

  const save = () => {
    if (!draft.name.trim()) return;
    onSave({
      name: draft.name.trim(),
      company: draft.company,
      email: draft.email,
    });
    onClose();
  };

  return (
    <PanelShell title="New client" onClose={onClose}>
      <div className="p-6 space-y-4">
        <Field label="Name">
          <TextInput
            value={draft.name}
            onChange={(v) => setDraft({ ...draft, name: v })}
            placeholder="Mia Chen"
          />
        </Field>
        <Field label="Company">
          <TextInput
            value={draft.company}
            onChange={(v) => setDraft({ ...draft, company: v })}
            placeholder="Mia Chen Studio"
          />
        </Field>
        <Field label="Email">
          <TextInput
            type="email"
            value={draft.email}
            onChange={(v) => setDraft({ ...draft, email: v })}
            placeholder="mia@miachen.co"
          />
        </Field>
        <div className="pt-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-8 px-3 text-[13px] rounded hover:bg-secondary">
            Cancel
          </button>
          <button
            onClick={save}
            className="h-8 px-3 text-[13px] bg-primary text-primary-foreground rounded hover:opacity-90 font-medium"
          >
            Add
          </button>
        </div>
      </div>
    </PanelShell>
  );
}
