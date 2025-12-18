export function parseIso8601DurationToSeconds(
  value: string | null | undefined,
): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Supports the subset used by YouTube: PnDTnHnMnS (e.g. PT58S, PT12M34S, PT1H2M3S).
  const match =
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(trimmed);
  if (!match) {
    return null;
  }

  const days = match[1] ? Number.parseInt(match[1], 10) : 0;
  const hours = match[2] ? Number.parseInt(match[2], 10) : 0;
  const minutes = match[3] ? Number.parseInt(match[3], 10) : 0;
  const secondsRaw = match[4] ? Number.parseFloat(match[4]) : 0;

  const totalSeconds = days * 86_400 + hours * 3_600 + minutes * 60 + secondsRaw;
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return null;
  }

  return Math.round(totalSeconds);
}

