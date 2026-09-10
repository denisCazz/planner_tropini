export type StatoCliente = "ATTIVO" | "INATTIVO" | "PROSPECT";

export type UserRole = "ADMIN" | "USER" | "TECNICO";

/** Tecnico / utente dell'organizzazione (per assegnazioni e filtri) */
export interface OrgUser {
  id: string;
  username: string;
  role: UserRole;
  nome?: string | null;
  cognome?: string | null;
  telefono?: string | null;
  email?: string | null;
  attivo?: boolean;
  note?: string | null;
  assignedClientCount?: number;
  workingHours?: WorkingHoursSlot[] | null;
}

export interface ClientNote {
  id: number;
  clientId: number;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface Client {
  id: number;
  codiceCliente?: string | null;
  nome: string;
  cognome: string;
  ragioneSociale?: string | null;
  email: string | null;
  telefono: string | null;
  telefono2: string | null;
  codiceFiscale?: string | null;
  partitaIva?: string | null;
  indirizzo: string | null;
  civico?: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  marcaStufa: string | null;
  modelloStufa: string | null;
  note: string | null;
  stato: StatoCliente;
  urgente: boolean;
  icona?: string | null;
  ultimaVisita: string | null;
  lat: number | null;
  lng: number | null;
  geoStatus?: string | null;
  assignedUserId: string | null;
  assignedUserName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientFormData {
  nome: string;
  cognome: string;
  ragioneSociale: string;
  email: string;
  telefono: string;
  telefono2: string;
  codiceFiscale: string;
  partitaIva: string;
  codiceCliente: string;
  indirizzo: string;
  civico: string;
  cap: string;
  citta: string;
  provincia: string;
  marcaStufa: string;
  modelloStufa: string;
  note: string;
  stato: StatoCliente;
  urgente: boolean;
  ultimaVisita: string;
  assignedUserId: string;
}

export interface Settings {
  id: string;
  startLat: number;
  startLng: number;
  startLabel: string;
  nearestNeighbours: number;
}

export interface RouteStep {
  client: Client;
  order: number;
}

export interface RouteResult {
  steps: RouteStep[];
  geometry: [number, number][];
  totalDistance: number; // km
  totalDuration: number; // minuti
}

export interface RouteHistoryEntry {
  id: number;
  createdAt: string;
  clientIds: number[];
  label: string;
  totalDistance: number;
  totalDuration: number;
  stopCount: number;
  userId: string | null;
  ownerName: string | null;
}

export interface ZoneBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Esito della telefonata di conferma nel flusso "lavora a zona" */
export type CallStatus = "ok" | "ko";

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export type StatoAppuntamento = "PIANIFICATO" | "CONFERMATO" | "COMPLETATO" | "ANNULLATO";

export type TipoAppuntamento = "MANUTENZIONE" | "INSTALLAZIONE" | "SOPRALLUOGO" | "PRONTO_INTERVENTO";

/** Fascia oraria di lavoro: day 1-7 (lunedì=1), orari "HH:MM" */
export interface WorkingHoursSlot {
  day: number;
  start: string;
  end: string;
}

export interface Appointment {
  id: number;
  clientId: number;
  technicianId: string | null;
  technicianName: string | null;
  date: string; // YYYY-MM-DD
  startMin: number;
  durationMin: number;
  stato: StatoAppuntamento;
  tipo: TipoAppuntamento;
  note: string | null;
  client: {
    id: number;
    nome: string;
    cognome: string;
    telefono: string | null;
    indirizzo: string | null;
    citta: string | null;
    provincia: string | null;
    lat: number | null;
    lng: number | null;
    icona: string | null;
    urgente: boolean;
    marcaStufa: string | null;
    modelloStufa: string | null;
  };
}

export const TIPO_APPUNTAMENTO_LABEL: Record<TipoAppuntamento, string> = {
  MANUTENZIONE: "Manutenzione",
  INSTALLAZIONE: "Installazione",
  SOPRALLUOGO: "Sopralluogo",
  PRONTO_INTERVENTO: "Pronto intervento",
};

export const STATO_APPUNTAMENTO_LABEL: Record<StatoAppuntamento, string> = {
  PIANIFICATO: "Pianificato",
  CONFERMATO: "Confermato",
  COMPLETATO: "Completato",
  ANNULLATO: "Annullato",
};

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

/** Data locale YYYY-MM-DD da una Date */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Aggiunge giorni a una chiave YYYY-MM-DD, ritorna nuova chiave */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map((p) => parseInt(p, 10));
  const date = new Date(y, m - 1, d + days);
  return toLocalDateKey(date);
}

export function formatItalianDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((p) => parseInt(p, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

export type CategoriaSpesa =
  | "CARBURANTE"
  | "RICAMBI"
  | "ATTREZZATURA"
  | "PEDAGGI"
  | "ALLOGGIO"
  | "MARKETING"
  | "VARIE";

export const CATEGORIA_SPESA_LABEL: Record<CategoriaSpesa, string> = {
  CARBURANTE: "Carburante",
  RICAMBI: "Ricambi",
  ATTREZZATURA: "Attrezzatura",
  PEDAGGI: "Pedaggi",
  ALLOGGIO: "Alloggio",
  MARKETING: "Marketing",
  VARIE: "Varie",
};

export type StatoIntervento =
  | "DA_PIANIFICARE"
  | "DA_CONTATTARE"
  | "CONTATTATO"
  | "DISPONIBILITA_RICEVUTA"
  | "APPUNTAMENTO_PROPOSTO"
  | "CONFERMATO"
  | "PIANIFICATO"
  | "IN_CORSO"
  | "COMPLETATO"
  | "ANNULLATO"
  | "DA_RICONTATTARE";

export type TipoIntervento =
  | "MANUTENZIONE"
  | "ASSISTENZA"
  | "INSTALLAZIONE"
  | "SOPRALLUOGO"
  | "PRONTO_INTERVENTO";

export type PrioritaIntervento = "BASSA" | "MEDIA" | "ALTA" | "URGENTE";

export interface Intervento {
  id: number;
  clientId: number;
  plantId: number | null;
  technicianId: string | null;
  technicianName: string | null;
  tipo: TipoIntervento;
  priorita: PrioritaIntervento;
  durataStimata: number;
  stato: StatoIntervento;
  dataRichiesta: string;
  data: string | null;
  descrizione: string | null;
  note: string | null;
  ricavo: number;
  appointment: {
    id: number;
    date: string;
    startMin: number;
    durationMin: number;
    stato: string;
    technicianId: string | null;
  } | null;
  plant: {
    id: number;
    marca: string | null;
    modello: string | null;
    matricola: string | null;
    tipologia: string;
  } | null;
  client: {
    id: number;
    nome: string;
    cognome: string;
    ragioneSociale?: string | null;
    displayName: string;
    telefono: string | null;
    telefono2?: string | null;
    indirizzo: string;
    citta: string | null;
    provincia: string | null;
    cap?: string | null;
    lat: number | null;
    lng: number | null;
    urgente: boolean;
  } | null;
}

export interface Spesa {
  id: number;
  data: string; // YYYY-MM-DD
  categoria: CategoriaSpesa;
  importo: number;
  descrizione: string | null;
}

export interface FinancialSummary {
  ricavi: number;
  spese: number;
  netto: number;
  interventi: number;
  perMese: { mese: string; ricavi: number; spese: number; netto: number; interventi: number }[];
  perTecnico: { technicianId: string | null; technicianName: string; ricavi: number; interventi: number }[];
  perCategoria: { categoria: CategoriaSpesa; totale: number }[];
}

export function formatItalianDateLong(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((p) => parseInt(p, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}
