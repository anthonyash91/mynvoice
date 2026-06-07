export function splitQuantityToHoursMinutes(quantity: number): {
  hours: number;
  minutes: number;
} {
  const totalMinutes = Math.round(Math.max(0, quantity) * 60);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function quantityFromHoursMinutes(hours: number, minutes: number): number {
  const h = Math.max(0, Number.isFinite(hours) ? hours : 0);
  const m = Math.min(59, Math.max(0, Number.isFinite(minutes) ? minutes : 0));
  return h + m / 60;
}

export function formatDurationQuantity(quantity: number): string {
  const { hours, minutes } = splitQuantityToHoursMinutes(quantity);
  if (hours === 0 && minutes === 0) return '0h';
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatInvoiceQuantity(quantity: number): string {
  const { minutes } = splitQuantityToHoursMinutes(quantity);
  const isWholeNumber = Math.abs(quantity - Math.round(quantity)) < 0.001;
  if (isWholeNumber && minutes === 0) return String(Math.round(quantity));
  return formatDurationQuantity(quantity);
}

export function parseDurationField(value: string): number {
  if (value.trim() === '') return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
