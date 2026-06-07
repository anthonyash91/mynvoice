import type { Client, RecurringCalendarExclusion } from '@/types';

function exclusionKey(exclusion: RecurringCalendarExclusion): string {
  return `${exclusion.clientId}:${exclusion.recurringLineItemId}:${exclusion.monthKey}`;
}

export function dedupeRecurringCalendarExclusions(
  exclusions: RecurringCalendarExclusion[]
): RecurringCalendarExclusion[] {
  const seen = new Set<string>();
  return exclusions.filter((exclusion) => {
    const key = exclusionKey(exclusion);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function recurringExclusionsForClient(
  client: Client,
  globalExclusions: RecurringCalendarExclusion[]
): RecurringCalendarExclusion[] {
  const fromClient = client.recurringCalendarExclusions.map((exclusion) => ({
    clientId: client.id,
    recurringLineItemId: exclusion.recurringLineItemId,
    monthKey: exclusion.monthKey,
  }));

  const fromGlobal = globalExclusions.filter((exclusion) => exclusion.clientId === client.id);

  return dedupeRecurringCalendarExclusions([...fromClient, ...fromGlobal]);
}

export function addGlobalRecurringCalendarExclusion(
  exclusions: RecurringCalendarExclusion[],
  clientId: string,
  recurringLineItemId: string,
  monthKey: string
): RecurringCalendarExclusion[] {
  const next = {
    clientId,
    recurringLineItemId,
    monthKey,
  };

  if (exclusions.some((exclusion) => exclusionKey(exclusion) === exclusionKey(next))) {
    return exclusions;
  }

  return [...exclusions, next];
}

function storageKey(userId: string): string {
  return `mynvoice-recurring-exclusions-${userId}`;
}

export function loadPersistedRecurringExclusions(
  userId: string
): RecurringCalendarExclusion[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecurringCalendarExclusion[];
    if (!Array.isArray(parsed)) return [];
    return dedupeRecurringCalendarExclusions(
      parsed.filter(
        (item) =>
          item &&
          typeof item.clientId === 'string' &&
          typeof item.recurringLineItemId === 'string' &&
          typeof item.monthKey === 'string'
      )
    );
  } catch {
    return [];
  }
}

export function persistRecurringExclusions(
  userId: string,
  exclusions: RecurringCalendarExclusion[]
): void {
  localStorage.setItem(
    storageKey(userId),
    JSON.stringify(dedupeRecurringCalendarExclusions(exclusions))
  );
}
