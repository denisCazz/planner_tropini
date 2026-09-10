import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, resolveAssignedUser, INVALID_ASSIGNEE, ownTechnicianFilter } from "@/lib/tenant";
import { canOperate, isTechnician } from "@/lib/roles";
import { parseDateKey } from "@/lib/dates";
import { isPriorita, isStatoIntervento, isTipoIntervento } from "@/lib/status";
import { interventoInclude, serializeIntervento } from "@/lib/serializers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const interventoId = parseInt(id, 10);
  if (Number.isNaN(interventoId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }

  const row = await prisma.intervento.findFirst({
    where: {
      id: interventoId,
      organizationId: session!.organizationId,
      ...ownTechnicianFilter(session!),
    },
    include: interventoInclude,
  });
  if (!row) return NextResponse.json({ error: "Intervento non trovato" }, { status: 404 });
  return NextResponse.json(serializeIntervento(row));
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const interventoId = parseInt(id, 10);
  if (Number.isNaN(interventoId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }

  const existing = await prisma.intervento.findFirst({
    where: { id: interventoId, organizationId: session!.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Intervento non trovato" }, { status: 404 });
  }

  if (isTechnician(session!.role) && existing.technicianId !== session!.userId) {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const data: Prisma.InterventoUpdateInput = {};

  if (isTechnician(session!.role)) {
    if (b.stato !== undefined) {
      if (!isStatoIntervento(b.stato)) {
        return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
      }
      data.stato = b.stato;
    }
    if (b.note !== undefined) {
      data.note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 2000) : null;
    }
  } else if (canOperate(session!.role)) {
    if (b.stato !== undefined) {
      if (!isStatoIntervento(b.stato)) {
        return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
      }
      data.stato = b.stato;
    }
    if (b.tipo !== undefined) {
      if (!isTipoIntervento(b.tipo)) {
        return NextResponse.json({ error: "Tipo non valido" }, { status: 400 });
      }
      data.tipo = b.tipo;
    }
    if (b.priorita !== undefined) {
      if (!isPriorita(b.priorita)) {
        return NextResponse.json({ error: "Priorità non valida" }, { status: 400 });
      }
      data.priorita = b.priorita;
    }
    if (b.durataStimata !== undefined) {
      const d = typeof b.durataStimata === "number" ? Math.round(b.durataStimata) : NaN;
      if (Number.isNaN(d) || d < 15 || d > 480) {
        return NextResponse.json({ error: "Durata non valida" }, { status: 400 });
      }
      data.durataStimata = d;
    }
    if (b.descrizione !== undefined) {
      data.descrizione =
        typeof b.descrizione === "string" && b.descrizione.trim()
          ? b.descrizione.trim().slice(0, 2000)
          : null;
    }
    if (b.note !== undefined) {
      data.note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 2000) : null;
    }
    if (b.technicianId !== undefined) {
      const technician = await resolveAssignedUser(b.technicianId, session!.organizationId);
      if (technician === INVALID_ASSIGNEE) {
        return NextResponse.json({ error: "Tecnico non valido" }, { status: 400 });
      }
      data.technician = technician
        ? { connect: { id: technician } }
        : { disconnect: true };
    }
    if (b.plantId !== undefined) {
      if (b.plantId === null || b.plantId === "") {
        data.plant = { disconnect: true };
      } else {
        const plantId = typeof b.plantId === "number" ? b.plantId : parseInt(String(b.plantId), 10);
        const plant = await prisma.plant.findFirst({
          where: {
            id: plantId,
            clientId: existing.clientId,
            organizationId: session!.organizationId,
          },
          select: { id: true },
        });
        if (!plant) return NextResponse.json({ error: "Impianto non trovato" }, { status: 404 });
        data.plant = { connect: { id: plant.id } };
      }
    }
    if (b.data !== undefined) {
      data.data = parseDateKey(b.data);
    }
  } else {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  const updated = await prisma.intervento.update({
    where: { id: interventoId },
    data,
    include: interventoInclude,
  });
  return NextResponse.json(serializeIntervento(updated));
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!canOperate(session!.role)) {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  const { id } = await params;
  const interventoId = parseInt(id, 10);
  if (Number.isNaN(interventoId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }

  const found = await prisma.intervento.findFirst({
    where: { id: interventoId, organizationId: session!.organizationId },
    select: { id: true },
  });
  if (!found) {
    return NextResponse.json({ error: "Intervento non trovato" }, { status: 404 });
  }

  await prisma.intervento.delete({ where: { id: interventoId } });
  return NextResponse.json({ ok: true });
}
