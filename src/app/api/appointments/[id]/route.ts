import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOperator, resolveAssignedUser, INVALID_ASSIGNEE } from "@/lib/tenant";
import {
  serializeAppointment,
  appointmentInclude,
} from "@/app/api/appointments/route";
import { parseDateKey } from "@/lib/dates";
import { statoAfterAppointment } from "@/lib/status";
import { findAppointmentConflict, isValidAppointmentWindow } from "@/lib/appointments";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const STATI = ["PIANIFICATO", "CONFERMATO", "COMPLETATO", "ANNULLATO"] as const;
const TIPI = ["MANUTENZIONE", "INSTALLAZIONE", "SOPRALLUOGO", "PRONTO_INTERVENTO"] as const;

async function findAppointment(id: number, organizationId: string) {
  return prisma.appointment.findFirst({
    where: { id, organizationId },
    select: { id: true, technicianId: true, date: true, startMin: true, durationMin: true, stato: true },
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const appointmentId = parseInt(id, 10);
  if (Number.isNaN(appointmentId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }
  const existing = await findAppointment(appointmentId, session!.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Appuntamento non trovato" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const data: Record<string, unknown> = {};

  if (b.date !== undefined) {
    const date = parseDateKey(b.date);
    if (!date) {
      return NextResponse.json({ error: "Data non valida" }, { status: 400 });
    }
    data.date = date;
  }

  if (b.startMin !== undefined) {
    const startMin = typeof b.startMin === "number" ? Math.round(b.startMin) : NaN;
    if (Number.isNaN(startMin) || startMin < 0 || startMin > 1439) {
      return NextResponse.json({ error: "Ora di inizio non valida" }, { status: 400 });
    }
    data.startMin = startMin;
  }

  if (b.durationMin !== undefined) {
    const durationMin = typeof b.durationMin === "number" ? Math.round(b.durationMin) : NaN;
    if (Number.isNaN(durationMin) || durationMin < 5 || durationMin > 1440) {
      return NextResponse.json({ error: "Durata non valida" }, { status: 400 });
    }
    data.durationMin = durationMin;
  }

  if (b.stato !== undefined) {
    if (!STATI.includes(b.stato as (typeof STATI)[number])) {
      return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
    }
    data.stato = b.stato;
  }

  if (b.tipo !== undefined) {
    if (!TIPI.includes(b.tipo as (typeof TIPI)[number])) {
      return NextResponse.json({ error: "Tipo non valido" }, { status: 400 });
    }
    data.tipo = b.tipo;
  }

  if (b.note !== undefined) {
    data.note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 2000) : null;
  }

  if (b.technicianId !== undefined) {
    const technician = await resolveAssignedUser(b.technicianId, session!.organizationId);
    if (technician === INVALID_ASSIGNEE) {
      return NextResponse.json({ error: "Tecnico non valido" }, { status: 400 });
    }
    data.technicianId = technician;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  const nextDate = (data.date as Date | undefined) ?? existing.date;
  const nextStartMin = (data.startMin as number | undefined) ?? existing.startMin;
  const nextDurationMin = (data.durationMin as number | undefined) ?? existing.durationMin;
  const nextTechnicianId = (data.technicianId as string | null | undefined) ?? existing.technicianId;
  const nextStato = (data.stato as string | undefined) ?? existing.stato;

  if (!isValidAppointmentWindow(nextStartMin, nextDurationMin)) {
    return NextResponse.json({ error: "L'appuntamento non può terminare oltre la mezzanotte" }, { status: 400 });
  }
  if (nextStato !== "ANNULLATO") {
    const conflict = await findAppointmentConflict({
      organizationId: session!.organizationId,
      technicianId: nextTechnicianId,
      date: nextDate,
      startMin: nextStartMin,
      durationMin: nextDurationMin,
      excludeId: existing.id,
    });
    if (conflict) {
      return NextResponse.json(
        { error: `Il tecnico ha già un appuntamento sovrapposto (#${conflict.id})` },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data,
    include: appointmentInclude,
  });

  if (updated.interventoId && (data.stato !== undefined || data.technicianId !== undefined || data.date !== undefined)) {
    await prisma.intervento.update({
      where: { id: updated.interventoId },
      data: {
        ...(data.stato ? { stato: statoAfterAppointment(String(data.stato)) } : {}),
        ...(data.technicianId !== undefined ? { technicianId: updated.technicianId } : {}),
        ...(data.date ? { data: updated.date } : {}),
      },
    });
  }

  return NextResponse.json(serializeAppointment(updated));
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const appointmentId = parseInt(id, 10);
  if (Number.isNaN(appointmentId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }
  if (!(await findAppointment(appointmentId, session!.organizationId))) {
    return NextResponse.json({ error: "Appuntamento non trovato" }, { status: 404 });
  }

  await prisma.appointment.delete({ where: { id: appointmentId } });

  return NextResponse.json({ ok: true });
}
