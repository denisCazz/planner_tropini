export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map((p) => parseInt(p, 10));
  const date = new Date(y, m - 1, d + days);
  return toLocalDateKey(date);
}

export function parseDateKey(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const mo = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Date normalizza silenziosamente, ad esempio 2026-02-31 → 3 marzo.
  // Una data operativa deve essere valida esattamente come è stata inserita.
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

export function minutesToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function hhmmToMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function formatItalianDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((p) => parseInt(p, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

export function formatItalianDateLong(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((p) => parseInt(p, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

export const WEEKDAY_LABEL = ["", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
