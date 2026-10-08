import { supabase } from '@/lib/supabase';
import type { CalendarEntry, Invoice, LineItem, LineItemAttachment } from '@/types';

export const ATTACHMENTS_BUCKET = 'invoice-attachments';

/** Per-file cap. Keep in sync with the bucket file_size_limit in migrate-line-item-attachments.sql. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/**
 * Per-invoice cap. Resend allows 40 MB per email after base64 (~4/3 growth), and the
 * invoice PDF itself can be up to 5 MB. Keep in sync with _shared/lineItemAttachments.ts.
 */
export const MAX_INVOICE_ATTACHMENTS_BYTES = 20 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'heic'];

export const ATTACHMENT_ACCEPT = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

const MISSING_BUCKET_HINT =
  'File attachments are not set up yet. Run supabase/migrate-line-item-attachments.sql in Supabase.';

export function lineItemAttachments(
  item: Pick<LineItem, 'attachments'> | Pick<CalendarEntry, 'attachments'>
): LineItemAttachment[] {
  return Array.isArray(item.attachments) ? item.attachments : [];
}

/** Combine two attachment lists, keeping the first occurrence of each attachment id. */
export function mergeAttachments(
  first: LineItemAttachment[],
  second: LineItemAttachment[]
): LineItemAttachment[] {
  const seen = new Set(first.map((attachment) => attachment.id));
  return [...first, ...second.filter((attachment) => !seen.has(attachment.id))];
}

export function invoiceAttachments(lineItems: LineItem[]): LineItemAttachment[] {
  return lineItems.flatMap(lineItemAttachments);
}

export function invoiceAttachmentPaths(lineItems: LineItem[]): string[] {
  return invoiceAttachments(lineItems)
    .map((attachment) => attachment.path)
    .filter(Boolean);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
}

function safeStorageFileName(fileName: string): string {
  const cleaned = fileName
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return cleaned || 'attachment';
}

function isMissingBucketError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('bucket not found') || message.includes('not found');
}

/** Returns an error message when the file cannot be attached, otherwise null. */
export function validateAttachmentFile(file: File, existingInvoiceBytes: number): string | null {
  if (!ACCEPTED_EXTENSIONS.includes(fileExtension(file.name))) {
    return `"${file.name}" is not a supported file. Attach a PDF or an image (PNG, JPG, WEBP, HEIC).`;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `"${file.name}" is ${formatFileSize(file.size)}. Attachments must be ${formatFileSize(MAX_ATTACHMENT_BYTES)} or smaller.`;
  }
  if (existingInvoiceBytes + file.size > MAX_INVOICE_ATTACHMENTS_BYTES) {
    return `Attachments on one invoice can total at most ${formatFileSize(MAX_INVOICE_ATTACHMENTS_BYTES)} so the email can be delivered.`;
  }
  return null;
}

export async function uploadLineItemAttachment(file: File): Promise<LineItemAttachment> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated. Please sign in again.');

  const id = crypto.randomUUID();
  const path = `${session.user.id}/${id}/${safeStorageFileName(file.name)}`;
  const contentType = file.type || 'application/octet-stream';

  const { error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, file, { contentType, upsert: false });

  if (error) {
    throw new Error(isMissingBucketError(error) ? MISSING_BUCKET_HINT : error.message);
  }

  return { id, fileName: file.name, path, contentType, size: file.size };
}

export async function openLineItemAttachment(attachment: LineItemAttachment): Promise<void> {
  // Open synchronously so popup blockers allow it, then point it at the signed URL.
  const tab = window.open('', '_blank');
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(attachment.path, 60);

  if (error || !data?.signedUrl) {
    tab?.close();
    throw new Error(`Could not open "${attachment.fileName}". It may have been deleted.`);
  }

  if (tab) {
    tab.opener = null;
    tab.location.href = data.signedUrl;
  } else {
    window.location.assign(data.signedUrl);
  }
}

/**
 * Validate and upload files one at a time, reporting each success so the caller can
 * show it immediately. Returns an error message for the last file that failed, if any.
 */
export async function uploadAttachmentFiles(
  files: File[],
  existingBytes: number,
  onUploaded: (attachment: LineItemAttachment) => void | Promise<void>
): Promise<string | null> {
  let totalBytes = existingBytes;
  let errorMessage: string | null = null;

  for (const file of files) {
    const invalid = validateAttachmentFile(file, totalBytes);
    if (invalid) {
      errorMessage = invalid;
      continue;
    }
    try {
      const attachment = await uploadLineItemAttachment(file);
      totalBytes += attachment.size;
      await onUploaded(attachment);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to upload attachment.';
    }
  }

  return errorMessage;
}

export function attachmentsTotalBytes(attachments: LineItemAttachment[]): number {
  return attachments.reduce((sum, attachment) => sum + attachment.size, 0);
}

/** Best-effort cleanup; a leftover file only costs storage, so failures are logged, not thrown. */
export async function deleteAttachmentFiles(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;

  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove(unique);
  if (error) {
    console.warn('Failed to delete invoice attachments:', error.message);
  }
}

/**
 * Delete files that no invoice line item or calendar entry still references.
 * Calendar entries and the invoice line items built from them share the same files.
 */
export function deleteUnreferencedAttachmentFiles(
  candidatePaths: string[],
  invoices: Invoice[],
  calendarEntries: CalendarEntry[]
): Promise<void> {
  const referenced = new Set([
    ...invoices.flatMap((invoice) => invoiceAttachmentPaths(invoice.lineItems)),
    ...calendarEntries.flatMap((entry) =>
      lineItemAttachments(entry).map((attachment) => attachment.path)
    ),
  ]);
  return deleteAttachmentFiles(candidatePaths.filter((path) => !referenced.has(path)));
}
