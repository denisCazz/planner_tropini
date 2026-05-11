export type StatoCliente = "ATTIVO" | "INATTIVO" | "PROSPECT";

export interface Client {
  id: number;
  nome: string;
  cognome: string;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  note: string | null;
  stato: StatoCliente;
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
  indirizzo: string;
  note: string;
  stato: StatoCliente;
  ultimaVisita: string;
}

export interface Settings {
  id: string;
  startLat: number;
  startLng: number;
  startLabel: string;
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
