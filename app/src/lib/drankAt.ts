// Local-date helpers for the review "Date" field. All comparisons use the
// device's local calendar day — a matcha drunk "on the 16th" means the 16th
// where the reviewer was, not UTC.

const pad = (n: number) => String(n).padStart(2, '0');

export function localDateString(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayLocalDate(): string {
  return localDateString(new Date().toISOString());
}

// Applies a YYYY-MM-DD choice to an existing timestamp: no/same-day choice
// keeps the timestamp untouched (preserving time-of-day ordering); a different
// day becomes local noon — noon can't drift across a day boundary when the
// timestamp is later rendered in a nearby timezone.
export function applyDrankAtDate(baseIso: string, dateStr?: string): string {
  const m = dateStr && /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return baseIso;
  if (localDateString(baseIso) === dateStr) return baseIso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0).toISOString();
}
