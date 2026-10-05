import type { Client } from "./client";

export type PlanStatus = "BOZZA" | "CONFERMA" | "PRONTO" | "INVIATO";
export type StopStatus = "DA_CHIAMARE" | "SMS_INVIATO" | "CONFERMATO" | "NON_DISPONIBILE" | "NESSUNA_RISPOSTA";

export interface Technician {
  id: string;
  nome: string | null;
  cognome: string | null;
  username: string;
  email: string | null;
  telefono: string | null;
}

export interface PlanStop {
  id: number;
  clientId: number;
  client: Client;
  ordine: number | null;
  status: StopStatus;
  orario: string | null;
  score: number;
  motivo: string | null;
  distanzaKm: number | null;
  note: string | null;
  messages: { id: number; direction: "OUT" | "IN"; body: string; createdAt: string }[];
}

export interface Plan {
  id: number;
  batchId: string;
  data: string;
  technician: Technician;
  zona: string;
  raggioKm: number;
  numeroClienti: number;
  status: PlanStatus;
  totalDistance: number | null;
  totalDuration: number | null;
  publicToken: string;
  stops: PlanStop[];
}

export interface Candidate {
  client: Client;
  score: number;
  distanzaKm: number;
  motivi: string[];
}
