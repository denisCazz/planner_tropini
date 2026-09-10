import { technicianDisplayName } from "@/lib/roles";
import type {
  Intervento,
  Client,
  Plant,
  User,
  Appointment,
  CustomerAvailability,
} from "@prisma/client";

export type InterventoWithRelations = Intervento & {
  technician?: Pick<User, "username" | "nome" | "cognome"> | null;
  client?: Pick<
    Client,
    | "id"
    | "nome"
    | "cognome"
    | "ragioneSociale"
    | "telefono"
    | "telefono2"
    | "indirizzo"
    | "civico"
    | "citta"
    | "provincia"
    | "cap"
    | "lat"
    | "lng"
    | "urgente"
  > | null;
  plant?: Pick<Plant, "id" | "marca" | "modello" | "matricola" | "tipologia"> | null;
  appointment?: Pick<
    Appointment,
    "id" | "date" | "startMin" | "durationMin" | "stato" | "technicianId"
  > | null;
  availabilities?: CustomerAvailability[];
};

export function clientDisplayName(c: {
  nome: string;
  cognome: string;
  ragioneSociale?: string | null;
}): string {
  const person = [c.cognome, c.nome].filter(Boolean).join(" ").trim();
  if (c.ragioneSociale && person) return `${c.ragioneSociale} (${person})`;
  return c.ragioneSociale || person || "Cliente";
}

export function serializeIntervento(i: InterventoWithRelations) {
  return {
    id: i.id,
    clientId: i.clientId,
    plantId: i.plantId,
    technicianId: i.technicianId,
    technicianName: i.technician ? technicianDisplayName(i.technician) : null,
    tipo: i.tipo,
    priorita: i.priorita,
    durataStimata: i.durataStimata,
    stato: i.stato,
    dataRichiesta: i.dataRichiesta.toISOString(),
    data: i.data ? i.data.toISOString().slice(0, 10) : null,
    descrizione: i.descrizione,
    note: i.note,
    ricavo: Number(i.ricavo),
    appointment: i.appointment
      ? {
          id: i.appointment.id,
          date: i.appointment.date.toISOString().slice(0, 10),
          startMin: i.appointment.startMin,
          durationMin: i.appointment.durationMin,
          stato: i.appointment.stato,
          technicianId: i.appointment.technicianId,
        }
      : null,
    plant: i.plant
      ? {
          id: i.plant.id,
          marca: i.plant.marca,
          modello: i.plant.modello,
          matricola: i.plant.matricola,
          tipologia: i.plant.tipologia,
        }
      : null,
    client: i.client
      ? {
          id: i.client.id,
          nome: i.client.nome,
          cognome: i.client.cognome,
          ragioneSociale: i.client.ragioneSociale,
          displayName: clientDisplayName(i.client),
          telefono: i.client.telefono,
          telefono2: i.client.telefono2,
          indirizzo: [i.client.indirizzo, i.client.civico].filter(Boolean).join(" "),
          citta: i.client.citta,
          provincia: i.client.provincia,
          cap: i.client.cap,
          lat: i.client.lat,
          lng: i.client.lng,
          urgente: i.client.urgente,
        }
      : null,
    availabilities: (i.availabilities ?? []).map(serializeAvailability),
  };
}

export const interventoInclude = {
  technician: { select: { username: true, nome: true, cognome: true } },
  client: {
    select: {
      id: true,
      nome: true,
      cognome: true,
      ragioneSociale: true,
      telefono: true,
      telefono2: true,
      indirizzo: true,
      civico: true,
      citta: true,
      provincia: true,
      cap: true,
      lat: true,
      lng: true,
      urgente: true,
    },
  },
  plant: {
    select: { id: true, marca: true, modello: true, matricola: true, tipologia: true },
  },
  appointment: {
    select: { id: true, date: true, startMin: true, durationMin: true, stato: true, technicianId: true },
  },
  availabilities: { orderBy: { createdAt: "desc" as const }, take: 8 },
} as const;

export function serializeAvailability(a: CustomerAvailability) {
  return {
    id: a.id,
    clientId: a.clientId,
    interventoId: a.interventoId,
    tipo: a.tipo,
    date: a.date ? a.date.toISOString().slice(0, 10) : null,
    startMin: a.startMin,
    endMin: a.endMin,
    weekday: a.weekday,
    periodo: a.periodo,
    note: a.note,
    createdAt: a.createdAt.toISOString(),
  };
}

export function serializePlant(
  p: Plant & { client?: Pick<Client, "id" | "nome" | "cognome" | "ragioneSociale" | "citta"> | null; _count?: { interventi: number } }
) {
  return {
    id: p.id,
    clientId: p.clientId,
    marca: p.marca,
    modello: p.modello,
    matricola: p.matricola,
    tipologia: p.tipologia,
    annoInstallazione: p.annoInstallazione,
    dataUltimoIntervento: p.dataUltimoIntervento
      ? p.dataUltimoIntervento.toISOString().slice(0, 10)
      : null,
    note: p.note,
    interventiCount: p._count?.interventi ?? undefined,
    client: p.client
      ? {
          id: p.client.id,
          displayName: clientDisplayName(p.client),
          citta: p.client.citta,
        }
      : undefined,
  };
}
