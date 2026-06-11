import { useEffect } from 'react';
import { Button } from '@/components/Button';
import { FormFooter } from '@/components/FormFooter';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      data-confirm-dialog
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
    >
      <button
        type="button"
        aria-label="Close dialog"
        disabled={loading}
        onClick={onCancel}
        className="absolute inset-0 bg-foreground/20 animate-fade-in"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="relative w-full max-w-sm bg-background border border-border rounded-lg p-6 animate-fade-in"
      >
        <h2 id="confirm-dialog-title" className="text-[15px] font-medium">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="text-[13px] text-muted-foreground mt-2">
          {description}
        </p>
        <FormFooter bordered={false} className="mt-6">
          <Button onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant="destructiveFilled"
            onClick={onConfirm}
            disabled={loading}
            loading={loading}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </Button>
        </FormFooter>
      </div>
    </div>
  );
}
