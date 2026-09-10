import { NextRequest, NextResponse } from "next/server";
import type { Prisma, TipoImpianto } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, requireOperator } from "@/lib/tenant";
import { serializePlant } from "@/lib/serializers";
import { interventoInclude, serializeIntervento } from "@/lib/serializers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const TIPI: TipoImpianto[] = ["STUFA", "CALDAIA", "TERMOCAMINO", "POMPA_CALORE", "ALTRO"];

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const plantId = parseInt(id, 10);
  if (Number.isNaN(plantId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }

  const plant = await prisma.plant.findFirst({
    where: { id: plantId, organizationId: session!.organizationId },
    include: {
      client: { select: { id: true, nome: true, cognome: true, ragioneSociale: true, citta: true } },
      _count: { select: { interventi: true } },
    },
  });
  if (!plant) return NextResponse.json({ error: "Impianto non trovato" }, { status: 404 });

  const interventi = await prisma.intervento.findMany({
    where: { plantId: plant.id, organizationId: session!.organizationId },
    include: interventoInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    ...serializePlant(plant),
    interventi: interventi.map(serializeIntervento),
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const plantId = parseInt(id, 10);
  if (Number.isNaN(plantId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }

  const existing = await prisma.plant.findFirst({
    where: { id: plantId, organizationId: session!.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Impianto non trovato" }, { status: 404 });

  const body = await req.json();
  const data: Prisma.PlantUpdateInput = {};

  if (body.marca !== undefined) data.marca = body.marca?.trim() || null;
  if (body.modello !== undefined) data.modello = body.modello?.trim() || null;
  if (body.matricola !== undefined) data.matricola = body.matricola?.trim() || null;
  if (body.note !== undefined) data.note = body.note?.trim()?.slice(0, 2000) || null;
  if (body.tipologia !== undefined && (TIPI as string[]).includes(body.tipologia)) {
    data.tipologia = body.tipologia;
  }
  if (body.annoInstallazione !== undefined) {
    const anno = body.annoInstallazione === null || body.annoInstallazione === ""
      ? null
      : parseInt(String(body.annoInstallazione), 10);
    data.annoInstallazione = anno && !Number.isNaN(anno) ? anno : null;
  }

  const plant = await prisma.plant.update({
    where: { id: plantId },
    data,
    include: {
      client: { select: { id: true, nome: true, cognome: true, ragioneSociale: true, citta: true } },
      _count: { select: { interventi: true } },
    },
  });

  return NextResponse.json(serializePlant(plant));
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const plantId = parseInt(id, 10);
  if (Number.isNaN(plantId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }

  const existing = await prisma.plant.findFirst({
    where: { id: plantId, organizationId: session!.organizationId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Impianto non trovato" }, { status: 404 });

  await prisma.plant.delete({ where: { id: plantId } });
  return NextResponse.json({ ok: true });
}
