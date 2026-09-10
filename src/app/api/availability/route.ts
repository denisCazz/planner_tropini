import { NextRequest, NextResponse } from "next/server";
import type { TipoDisponibilita, PeriodoGiorno } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, requireOperator, orgScope, assertClientInOrg } from "@/lib/tenant";
import { parseDateKey } from "@/lib/dates";
import { serializeAvailability } from "@/lib/serializers";
import { statoAfterAvailability } from "@/lib/status";

const TIPI: TipoDisponibilita[] = [
  "DISPONIBILE_FASCIA",
  "DISPONIBILE_GIORNO",
  "NON_DISPONIBILE",
  "RICHIAMARE",
];
const PERIODI: PeriodoGiorno[] = ["MATTINA", "POMERIGGIO", "SERA", "TUTTO_IL_GIORNO"];

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const clientIdRaw = searchParams.get("clientId");
  const interventoIdRaw = searchParams.get("interventoId");

  const where: Record<string, unknown> = { ...orgScope(session!.organizationId) };
  if (clientIdRaw) {
    const clientId = parseInt(clientIdRaw, 10);
    if (!Number.isNaN(clientId)) where.clientId = clientId;
  }
  if (interventoIdRaw) {
    const interventoId = parseInt(interventoIdRaw, 10);
    if (!Number.isNaN(interventoId)) where.interventoId = interventoId;
  }

  const rows = await prisma.customerAvailability.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(rows.map(serializeAvailability));
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireOperator();
  if (error) return error;

  const body = await req.json();
  const clientId = typeof body.clientId === "number" ? body.clientId : parseInt(String(body.clientId), 10);
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "Cliente mancante" }, { status: 400 });
  }
  if (!(await assertClientInOrg(clientId, session!.organizationId))) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const tipo = TIPI.includes(body.tipo) ? (body.tipo as TipoDisponibilita) : null;
  if (!tipo) {
    return NextResponse.json({ error: "Tipo disponibilità non valido" }, { status: 400 });
  }

  let interventoId: number | null = null;
  if (body.interventoId != null && body.interventoId !== "") {
    const parsed = typeof body.interventoId === "number" ? body.interventoId : parseInt(String(body.interventoId), 10);
    const found = await prisma.intervento.findFirst({
      where: { id: parsed, clientId, organizationId: session!.organizationId },
      select: { id: true },
    });
    if (!found) return NextResponse.json({ error: "Intervento non trovato" }, { status: 404 });
    interventoId = found.id;
  }

  const date = parseDateKey(body.date);
  const weekday = typeof body.weekday === "number" ? body.weekday : body.weekday ? parseInt(String(body.weekday), 10) : null;
  const periodo = PERIODI.includes(body.periodo) ? (body.periodo as PeriodoGiorno) : null;
  const startMin = typeof body.startMin === "number" ? body.startMin : null;
  const endMin = typeof body.endMin === "number" ? body.endMin : null;

  if (tipo === "DISPONIBILE_FASCIA" && (!date || startMin == null || endMin == null)) {
    return NextResponse.json({ error: "Servono data e fascia oraria" }, { status: 400 });
  }
  if (tipo === "DISPONIBILE_GIORNO" && !(weekday && weekday >= 1 && weekday <= 7) && !periodo) {
    return NextResponse.json({ error: "Servono giorno della settimana o periodo" }, { status: 400 });
  }
  if ((tipo === "NON_DISPONIBILE" || tipo === "RICHIAMARE") && !date) {
    return NextResponse.json({ error: "Serve una data" }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.customerAvailability.create({
      data: {
        organizationId: session!.organizationId,
        clientId,
        interventoId,
        tipo,
        date,
        startMin,
        endMin,
        weekday: weekday && weekday >= 1 && weekday <= 7 ? weekday : null,
        periodo,
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null,
      },
    });

    if (interventoId) {
      await tx.intervento.update({
        where: { id: interventoId },
        data: { stato: statoAfterAvailability(tipo) },
      });
    }

    return row;
  });

  return NextResponse.json(serializeAvailability(created), { status: 201 });
}
