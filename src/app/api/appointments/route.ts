import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireSession,
  requireOperator,
  orgScope,
  assertClientInOrg,
  resolveAssignedUser,
  INVALID_ASSIGNEE,
  ownTechnicianFilter,
} from "@/lib/tenant";
import { statoAfterAppointment } from "@/lib/status";
import { findAppointmentConflict, isValidAppointmentWindow } from "@/lib/appointments";
import { parseDateKey } from "@/lib/dates";

const STATI = ["PIANIFICATO", "CONFERMATO", "COMPLETATO", "ANNULLATO"] as const;
const TIPI = ["MANUTENZIONE", "INSTALLAZIONE", "SOPRALLUOGO", "PRONTO_INTERVENTO"] as const;

export type StatoAppuntamentoEnum = (typeof STATI)[number];
export type TipoAppuntamentoEnum = (typeof TIPI)[number];

export function serializeAppointment(a: {
  id: number;
  clientId: number;
  interventoId?: number | null;
  technicianId: string | null;
  date: Date;
  startMin: number;
  durationMin: number;
  stato: StatoAppuntamentoEnum;
  tipo: TipoAppuntamentoEnum;
  note: string | null;
  technician?: { username: string; nome?: string | null; cognome?: string | null } | null;
  client?: {
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
  } | null;
}) {
  const techName = a.technician
    ? [a.technician.nome, a.technician.cognome].filter(Boolean).join(" ").trim() || a.technician.username
    : null;
  return {
    id: a.id,
    clientId: a.clientId,
    interventoId: a.interventoId ?? null,
    technicianId: a.technicianId,
    technicianName: techName,
    date: a.date.toISOString().slice(0, 10),
    startMin: a.startMin,
    durationMin: a.durationMin,
    stato: a.stato,
    tipo: a.tipo,
    note: a.note,
    client: a.client
      ? {
          id: a.clientId,
          nome: a.client.nome,
          cognome: a.client.cognome,
          telefono: a.client.telefono,
          indirizzo: a.client.indirizzo,
          citta: a.client.citta,
          provincia: a.client.provincia,
          lat: a.client.lat,
          lng: a.client.lng,
          icona: a.client.icona,
          urgente: a.client.urgente,
          marcaStufa: a.client.marcaStufa,
          modelloStufa: a.client.modelloStufa,
        }
      : undefined,
  };
}

export const appointmentInclude = {
  technician: { select: { username: true, nome: true, cognome: true } },
  client: {
    select: {
      nome: true,
      cognome: true,
      telefono: true,
      indirizzo: true,
      citta: true,
      provincia: true,
      lat: true,
      lng: true,
      icona: true,
      urgente: true,
      marcaStufa: true,
      modelloStufa: true,
    },
  },
} as const;

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const from = parseDateKey(searchParams.get("from"));
  const to = parseDateKey(searchParams.get("to"));
  const technicianId = searchParams.get("technicianId");
  const clientIdRaw = searchParams.get("clientId");

  const where: Record<string, unknown> = { ...orgScope(session!.organizationId) };

  if (from && to) {
    where.date = { gte: from, lt: new Date(to.getTime() + 86400000) };
  } else if (from) {
    where.date = { gte: from };
  } else if (to) {
    where.date = { lt: new Date(to.getTime() + 86400000) };
  }

  const own = ownTechnicianFilter(session!);
  if (own.technicianId) {
    where.technicianId = own.technicianId;
  } else if (technicianId === "none") {
    where.technicianId = null;
  } else if (technicianId) {
    where.technicianId = technicianId;
  }

  if (clientIdRaw) {
    const clientId = parseInt(clientIdRaw, 10);
    if (Number.isNaN(clientId)) {
      return NextResponse.json({ error: "clientId non valido" }, { status: 400 });
    }
    where.clientId = clientId;
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: appointmentInclude,
    orderBy: [{ date: "asc" }, { startMin: "asc" }],
    take: 1000,
  });

  return NextResponse.json(appointments.map(serializeAppointment));
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireOperator();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const clientId = typeof b.clientId === "number" ? b.clientId : parseInt(String(b.clientId), 10);
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "Cliente mancante" }, { status: 400 });
  }
  if (!(await assertClientInOrg(clientId, session!.organizationId))) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const date = parseDateKey(b.date);
  if (!date) {
    return NextResponse.json({ error: "Data non valida (formato YYYY-MM-DD)" }, { status: 400 });
  }

  const startMin = typeof b.startMin === "number" ? Math.round(b.startMin) : NaN;
  if (Number.isNaN(startMin) || startMin < 0 || startMin > 1439) {
    return NextResponse.json({ error: "Ora di inizio non valida" }, { status: 400 });
  }

  const durationMin = typeof b.durationMin === "number" ? Math.round(b.durationMin) : 60;
  if (durationMin < 5 || durationMin > 1440) {
    return NextResponse.json({ error: "Durata non valida (5–1440 minuti)" }, { status: 400 });
  }
  if (!isValidAppointmentWindow(startMin, durationMin)) {
    return NextResponse.json({ error: "L'appuntamento non può terminare oltre la mezzanotte" }, { status: 400 });
  }

  const stato = STATI.includes(b.stato as StatoAppuntamentoEnum)
    ? (b.stato as StatoAppuntamentoEnum)
    : "PIANIFICATO";
  const tipo = TIPI.includes(b.tipo as TipoAppuntamentoEnum)
    ? (b.tipo as TipoAppuntamentoEnum)
    : "MANUTENZIONE";

  const technician = await resolveAssignedUser(b.technicianId, session!.organizationId);
  if (technician === INVALID_ASSIGNEE) {
    return NextResponse.json({ error: "Tecnico non valido" }, { status: 400 });
  }

  let interventoId: number | null = null;
  if (b.interventoId != null && b.interventoId !== "") {
    const parsed = typeof b.interventoId === "number" ? b.interventoId : parseInt(String(b.interventoId), 10);
    const found = await prisma.intervento.findFirst({
      where: { id: parsed, clientId, organizationId: session!.organizationId },
      select: { id: true, appointment: { select: { id: true } } },
    });
    if (!found) return NextResponse.json({ error: "Intervento non trovato" }, { status: 404 });
    if (found.appointment) {
      return NextResponse.json({ error: "Questo intervento ha già un appuntamento" }, { status: 409 });
    }
    interventoId = found.id;
  }

  const note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 2000) : null;

  if (stato !== "ANNULLATO") {
    const conflict = await findAppointmentConflict({
      organizationId: session!.organizationId,
      technicianId: technician,
      date,
      startMin,
      durationMin,
    });
    if (conflict) {
      return NextResponse.json(
        { error: `Il tecnico ha già un appuntamento sovrapposto (#${conflict.id})` },
        { status: 409 }
      );
    }
  }

  const appointment = await prisma.$transaction(async (tx) => {
    const created = await tx.appointment.create({
      data: {
        organizationId: session!.organizationId,
        clientId,
        interventoId,
        technicianId: technician,
        date,
        startMin,
        durationMin,
        stato,
        tipo,
        note,
      },
      include: appointmentInclude,
    });
    if (interventoId) {
      await tx.intervento.update({
        where: { id: interventoId },
        data: {
          stato: statoAfterAppointment(stato),
          technicianId: technician,
          data: date,
        },
      });
    }
    return created;
  });

  return NextResponse.json(serializeAppointment(appointment), { status: 201 });
}
