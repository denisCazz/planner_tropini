export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (!d) return null;
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (!d.startsWith("39") || d.length <= 10) d = `39${d}`;
  d = d.replace(/\D/g, "");
  if (d.length < 10 || d.length > 14) return null;
  return `+${d}`;
}

export function telHref(raw: string | null | undefined): string {
  const e = toE164(raw);
  return e ? `tel:${e}` : "#";
}

export function isMobileIt(raw: string | null | undefined): boolean {
  const e = toE164(raw);
  return !!e && e.startsWith("+393");
}

export function bestMobile(...nums: (string | null | undefined)[]): string | null {
  for (const n of nums) if (isMobileIt(n)) return toE164(n);
  return null;
}
