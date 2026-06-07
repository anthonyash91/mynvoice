const EMPTY_LINE = '\u00A0';

export function splitStreetAndCityLines(address: string): [string, string] {
  const trimmed = address.trim();
  if (!trimmed) return [EMPTY_LINE, EMPTY_LINE];

  const newlineIndex = trimmed.indexOf('\n');
  if (newlineIndex >= 0) {
    const street = trimmed.slice(0, newlineIndex).trim();
    const cityLine = trimmed.slice(newlineIndex + 1).trim();
    return [street || EMPTY_LINE, cityLine || EMPTY_LINE];
  }

  const commaIndex = trimmed.indexOf(',');
  if (commaIndex >= 0) {
    const street = trimmed.slice(0, commaIndex).trim();
    const cityLine = trimmed.slice(commaIndex + 1).trim();
    return [street || EMPTY_LINE, cityLine || EMPTY_LINE];
  }

  return [trimmed, EMPTY_LINE];
}
