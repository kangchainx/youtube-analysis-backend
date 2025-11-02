const unitMap: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDurationToMs(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  const match = trimmed.match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!match) {
    return undefined;
  }

  const amountStr = match[1];
  const unitRaw = match[2];
  if (!amountStr || !unitRaw) {
    return undefined;
  }

  const amount = Number.parseInt(amountStr, 10);
  const unit = unitRaw.toLowerCase();

  const multiplier = unitMap[unit];
  if (!multiplier) {
    return undefined;
  }

  return amount * multiplier;
}
