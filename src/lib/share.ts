import { formatItalianDateLong } from "./dates";

export function personName(c: { nome: string | null; cognome: string | null; username?: string }) {
  const n = `${c.cognome ?? ""} ${c.nome ?? ""}`.trim();
  return n || c.username || "Tecnico";
}

export function clientAddress(c: { indirizzo: string | null; citta: string | null }) {
  return [c.indirizzo, c.citta].filter(Boolean).join(", ");
}

function dateKey(d: Date | string) {
  return (typeof d === "string" ? new Date(d) : d).toISOString().slice(0, 10);
}

function stopParam(c: { lat: number | null; lng: number | null; indirizzo: string | null; citta: string | null; nome: string; cognome: string }) {
  if (c.lat != null && c.lng != null) return `${c.lat},${c.lng}`;
  return encodeURIComponent(clientAddress(c) || personName(c));
}

export function buildMapsUrl(start: { lat: number; lng: number } | null, stops: { client: Parameters<typeof stopParam>[0] }[]) {
  const parts = stops.map((s) => stopParam(s.client));
  if (start) {
    const s = `${start.lat},${start.lng}`;
    return `https://www.google.com/maps/dir/${[s, ...parts, s].join("/")}`;
  }
  return `https://www.google.com/maps/dir/${parts.join("/")}`;
}

export function navigateUrl(c: Parameters<typeof stopParam>[0]) {
  return `https://www.google.com/maps/dir/?api=1&destination=${stopParam(c)}&travelmode=driving`;
}

export function buildPlanText(
  plan: { data: Date | string; zona: string; totalDistance: number | null; totalDuration: number | null; technician: { nome: string | null; cognome: string | null; username: string } },
  stops: { orario: string | null; client: { nome: string; cognome: string; indirizzo: string | null; citta: string | null; telefono: string | null; lat: number | null; lng: number | null } }[],
  links: { maps: string; page?: string }
) {
  const lines = stops.map((s, i) => {
    const addr = clientAddress(s.client);
    return `${i + 1}. ${s.orario ? `${s.orario} ` : ""}${personName(s.client)}${addr ? ` — ${addr}` : ""}${s.client.telefono ? ` — ${s.client.telefono}` : ""}`;
  });
  return [
    `Giro ${formatItalianDateLong(dateKey(plan.data))} — ${personName(plan.technician)} (zona ${plan.zona})`,
    plan.totalDistance != null ? `${plan.totalDistance} km · ~${plan.totalDuration} min di guida` : "",
    "",
    ...lines,
    "",
    `Percorso: ${links.maps}`,
    links.page ? `Scheda: ${links.page}` : "",
  ]
    .filter((l, i, arr) => l !== "" || arr[i - 1] !== "")
    .join("\n")
    .trim();
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildPlanEmailHtml(
  plan: { data: Date | string; zona: string; totalDistance: number | null; totalDuration: number | null; technician: { nome: string | null; cognome: string | null; username: string } },
  stops: { orario: string | null; client: { nome: string; cognome: string; indirizzo: string | null; citta: string | null; telefono: string | null; lat: number | null; lng: number | null; marcaStufa?: string | null; modelloStufa?: string | null; note?: string | null } }[],
  links: { maps: string; page: string },
  company: string
) {
  const rows = stops
    .map((s, i) => {
      const c = s.client;
      const stufa = [c.marcaStufa, c.modelloStufa].filter(Boolean).join(" ");
      return `<tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f766e">${i + 1}</td><td style="padding:10px;border-bottom:1px solid #e2e8f0"><div style="font-weight:700">${s.orario ? `${esc(s.orario)} · ` : ""}${esc(personName(c))}</div><div style="color:#475569;font-size:13px">${esc(clientAddress(c))}</div>${stufa ? `<div style="font-size:12px;color:#64748b">Stufa: ${esc(stufa)}</div>` : ""}${c.telefono ? `<div><a href="tel:${esc(c.telefono.replace(/\s/g, ""))}">${esc(c.telefono)}</a></div>` : ""}<div><a href="${esc(navigateUrl(c))}">Naviga</a></div></td></tr>`;
    })
    .join("");
  return `<div style="font-family:sans-serif;max-width:560px"><h1 style="color:#0f766e">${esc(company)}</h1><p><strong>${esc(formatItalianDateLong(dateKey(plan.data)))}</strong> · ${esc(personName(plan.technician))} · zona ${esc(plan.zona)} · ${stops.length} tappe</p><p><a href="${esc(links.maps)}">Apri percorso in Google Maps</a> · <a href="${esc(links.page)}">Scheda giornata</a></p><table style="width:100%;border-collapse:collapse">${rows}</table></div>`;
}
