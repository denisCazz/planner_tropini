export type StatoCliente = "ATTIVO" | "INATTIVO" | "PROSPECT";

export interface Client {
  id: number;
  nome: string;
  cognome: string;
  email: string | null;
  telefono: string | null;
  telefono2: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  marcaStufa: string | null;
  modelloStufa: string | null;
  note: string | null;
  stato: StatoCliente;
  urgente: boolean;
  ultimaVisita: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientFormData {
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  telefono2: string;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
  marcaStufa: string;
  modelloStufa: string;
  note: string;
  stato: StatoCliente;
  urgente: boolean;
  ultimaVisita: string;
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

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}
