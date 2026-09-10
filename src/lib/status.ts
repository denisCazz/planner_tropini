import type { StatoIntervento, PrioritaIntervento, TipoIntervento } from "@prisma/client";

export const STATO_INTERVENTO = [
  "DA_PIANIFICARE",
  "DA_CONTATTARE",
  "CONTATTATO",
  "DISPONIBILITA_RICEVUTA",
  "APPUNTAMENTO_PROPOSTO",
  "CONFERMATO",
  "PIANIFICATO",
  "IN_CORSO",
  "COMPLETATO",
  "ANNULLATO",
  "DA_RICONTATTARE",
] as const satisfies readonly StatoIntervento[];

export const TIPO_INTERVENTO = [
  "MANUTENZIONE",
  "ASSISTENZA",
  "INSTALLAZIONE",
  "SOPRALLUOGO",
  "PRONTO_INTERVENTO",
] as const satisfies readonly TipoIntervento[];

export const PRIORITA_INTERVENTO = [
  "BASSA",
  "MEDIA",
  "ALTA",
  "URGENTE",
] as const satisfies readonly PrioritaIntervento[];

export type StatoMarkerKey =
  | "da_contattare"
  | "contattato"
  | "disponibilita"
  | "proposto"
  | "confermato"
  | "pianificato"
  | "completato"
  | "richiamare"
  | "annullato"
  | "altro";

export interface StatoMeta {
  key: StatoIntervento;
  label: string;
  short: string;
  color: string;
  bg: string;
  text: string;
  glyph: string;
  marker: StatoMarkerKey;
}

export const STATO_META: Record<StatoIntervento, StatoMeta> = {
  DA_PIANIFICARE: {
    key: "DA_PIANIFICARE",
    label: "Da pianificare",
    short: "Pianifica",
    color: "#64748b",
    bg: "bg-slate-100",
    text: "text-slate-700",
    glyph: "○",
    marker: "altro",
  },
  DA_CONTATTARE: {
    key: "DA_CONTATTARE",
    label: "Da contattare",
    short: "Chiama",
    color: "#d97706",
    bg: "bg-amber-100",
    text: "text-amber-800",
    glyph: "☎",
    marker: "da_contattare",
  },
  CONTATTATO: {
    key: "CONTATTATO",
    label: "Contattato",
    short: "Contattato",
    color: "#0284c7",
    bg: "bg-sky-100",
    text: "text-sky-800",
    glyph: "✓",
    marker: "contattato",
  },
  DISPONIBILITA_RICEVUTA: {
    key: "DISPONIBILITA_RICEVUTA",
    label: "Disponibilità ricevuta",
    short: "Disponibile",
    color: "#0d9488",
    bg: "bg-teal-100",
    text: "text-teal-800",
    glyph: "◷",
    marker: "disponibilita",
  },
  APPUNTAMENTO_PROPOSTO: {
    key: "APPUNTAMENTO_PROPOSTO",
    label: "Appuntamento proposto",
    short: "Proposto",
    color: "#7c3aed",
    bg: "bg-violet-100",
    text: "text-violet-800",
    glyph: "?",
    marker: "proposto",
  },
  CONFERMATO: {
    key: "CONFERMATO",
    label: "Confermato",
    short: "Confermato",
    color: "#2563eb",
    bg: "bg-blue-100",
    text: "text-blue-800",
    glyph: "★",
    marker: "confermato",
  },
  PIANIFICATO: {
    key: "PIANIFICATO",
    label: "Pianificato",
    short: "Pianificato",
    color: "#4f46e5",
    bg: "bg-indigo-100",
    text: "text-indigo-800",
    glyph: "▣",
    marker: "pianificato",
  },
  IN_CORSO: {
    key: "IN_CORSO",
    label: "In corso",
    short: "In corso",
    color: "#ea580c",
    bg: "bg-orange-100",
    text: "text-orange-800",
    glyph: "▶",
    marker: "pianificato",
  },
  COMPLETATO: {
    key: "COMPLETATO",
    label: "Completato",
    short: "Fatto",
    color: "#059669",
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    glyph: "✔",
    marker: "completato",
  },
  ANNULLATO: {
    key: "ANNULLATO",
    label: "Annullato",
    short: "Annullato",
    color: "#94a3b8",
    bg: "bg-slate-100",
    text: "text-slate-500",
    glyph: "✕",
    marker: "annullato",
  },
  DA_RICONTATTARE: {
    key: "DA_RICONTATTARE",
    label: "Da richiamare",
    short: "Richiamare",
    color: "#e11d48",
    bg: "bg-rose-100",
    text: "text-rose-800",
    glyph: "↻",
    marker: "richiamare",
  },
};

export const TIPO_LABEL: Record<TipoIntervento, string> = {
  MANUTENZIONE: "Manutenzione",
  ASSISTENZA: "Assistenza",
  INSTALLAZIONE: "Installazione",
  SOPRALLUOGO: "Sopralluogo",
  PRONTO_INTERVENTO: "Pronto intervento",
};

export const PRIORITA_META: Record<
  PrioritaIntervento,
  { label: string; color: string; bg: string; text: string }
> = {
  BASSA: { label: "Bassa", color: "#64748b", bg: "bg-slate-100", text: "text-slate-600" },
  MEDIA: { label: "Media", color: "#0284c7", bg: "bg-sky-100", text: "text-sky-700" },
  ALTA: { label: "Alta", color: "#d97706", bg: "bg-amber-100", text: "text-amber-800" },
  URGENTE: { label: "Urgente", color: "#dc2626", bg: "bg-red-100", text: "text-red-700" },
};

export const OPEN_STATI: StatoIntervento[] = [
  "DA_PIANIFICARE",
  "DA_CONTATTARE",
  "CONTATTATO",
  "DISPONIBILITA_RICEVUTA",
  "APPUNTAMENTO_PROPOSTO",
  "CONFERMATO",
  "PIANIFICATO",
  "IN_CORSO",
  "DA_RICONTATTARE",
];

export const PLANNING_CANDIDATE_STATI: StatoIntervento[] = [
  "DISPONIBILITA_RICEVUTA",
  "APPUNTAMENTO_PROPOSTO",
  "CONFERMATO",
  "DA_PIANIFICARE",
];

export function isStatoIntervento(v: unknown): v is StatoIntervento {
  return typeof v === "string" && (STATO_INTERVENTO as readonly string[]).includes(v);
}

export function isTipoIntervento(v: unknown): v is TipoIntervento {
  return typeof v === "string" && (TIPO_INTERVENTO as readonly string[]).includes(v);
}

export function isPriorita(v: unknown): v is PrioritaIntervento {
  return typeof v === "string" && (PRIORITA_INTERVENTO as readonly string[]).includes(v);
}

/** Dopo aver salvato una disponibilità, lo stato passa a DISPONIBILITA_RICEVUTA (o DA_RICONTATTARE). */
export function statoAfterAvailability(
  tipo: "DISPONIBILE_FASCIA" | "DISPONIBILE_GIORNO" | "NON_DISPONIBILE" | "RICHIAMARE"
): StatoIntervento {
  if (tipo === "RICHIAMARE") return "DA_RICONTATTARE";
  if (tipo === "NON_DISPONIBILE") return "CONTATTATO";
  return "DISPONIBILITA_RICEVUTA";
}

export function statoAfterAppointment(statoAppuntamento: string): StatoIntervento {
  if (statoAppuntamento === "CONFERMATO") return "CONFERMATO";
  if (statoAppuntamento === "COMPLETATO") return "COMPLETATO";
  if (statoAppuntamento === "ANNULLATO") return "DA_PIANIFICARE";
  return "PIANIFICATO";
}
