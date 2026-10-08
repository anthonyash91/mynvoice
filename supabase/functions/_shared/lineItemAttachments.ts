import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const ATTACHMENTS_BUCKET = 'invoice-attachments';

/** Keep in sync with MAX_INVOICE_ATTACHMENTS_BYTES in src/lib/attachments.ts. */
const MAX_INVOICE_ATTACHMENTS_BYTES = 20 * 1024 * 1024;

export interface EmailAttachment {
  filename: string;
  content: string;
}

interface StoredAttachment {
  fileName: string;
  path: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function storedAttachments(lineItems: unknown, userId: string): StoredAttachment[] {
  if (!Array.isArray(lineItems)) return [];

  const seen = new Set<string>();
  const result: StoredAttachment[] = [];

  for (const item of lineItems) {
    const attachments = asRecord(item)?.attachments;
    if (!Array.isArray(attachments)) continue;

    for (const raw of attachments) {
      const attachment = asRecord(raw);
      const path = typeof attachment?.path === 'string' ? attachment.path.trim() : '';
      // Service-role clients bypass storage RLS, so only ever read the owner's own folder.
      if (!path.startsWith(`${userId}/`) || path.includes('..') || seen.has(path)) continue;
      seen.add(path);

      const fileName =
        typeof attachment?.fileName === 'string' && attachment.fileName.trim()
          ? attachment.fileName.trim()
          : path.slice(path.lastIndexOf('/') + 1);
      result.push({ fileName, path });
    }
  }

  return result;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Download the files attached to an invoice's line items, ready for Resend.
 * Throws a user-facing message when a file is missing or the total is too large,
 * so the email is never sent without the receipts the owner attached.
 */
export async function loadLineItemAttachments(
  supabase: Pick<SupabaseClient, 'storage'>,
  userId: string,
  lineItems: unknown
): Promise<EmailAttachment[]> {
  const stored = storedAttachments(lineItems, userId);
  const result: EmailAttachment[] = [];
  let totalBytes = 0;

  for (const attachment of stored) {
    const { data, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .download(attachment.path);

    if (error || !data) {
      throw new Error(
        `Could not load attachment "${attachment.fileName}". Remove it from the line item or attach it again.`
      );
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_INVOICE_ATTACHMENTS_BYTES) {
      throw new Error(
        'Attachments on this invoice are larger than 20 MB, so the email cannot be delivered. Remove some attachments and try again.'
      );
    }

    result.push({ filename: attachment.fileName, content: bytesToBase64(bytes) });
  }

  return result;
}

/** Line items for the public invoice page: keep attachment names, never storage paths. */
export function publicLineItems(lineItems: unknown): unknown {
  if (!Array.isArray(lineItems)) return lineItems;

  return lineItems.map((item) => {
    const record = asRecord(item);
    if (!record || !Array.isArray(record.attachments)) return item;

    return {
      ...record,
      attachments: record.attachments.map((raw) => {
        const attachment = asRecord(raw) ?? {};
        return {
          id: String(attachment.id ?? ''),
          fileName: String(attachment.fileName ?? ''),
          path: '',
          contentType: String(attachment.contentType ?? ''),
          size: Number(attachment.size ?? 0),
        };
      }),
    };
  });
}
