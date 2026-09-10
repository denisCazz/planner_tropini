import { NextRequest, NextResponse } from "next/server";
import type { Prisma, TipoImpianto } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, requireOperator, orgScope, assertClientInOrg } from "@/lib/tenant";
import { serializePlant } from "@/lib/serializers";

const TIPI: TipoImpianto[] = ["STUFA", "CALDAIA", "TERMOCAMINO", "POMPA_CALORE", "ALTRO"];

function parseTipo(raw: unknown): TipoImpianto | null {
  return typeof raw === "string" && (TIPI as string[]).includes(raw) ? (raw as TipoImpianto) : null;
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const clientIdRaw = searchParams.get("clientId");
  const search = searchParams.get("search") ?? "";

  const where: Prisma.PlantWhereInput = { ...orgScope(session!.organizationId) };
  if (clientIdRaw) {
    const clientId = parseInt(clientIdRaw, 10);
    if (!Number.isNaN(clientId)) where.clientId = clientId;
  }
  if (search.trim()) {
    const q = search.trim();
    where.OR = [
      { marca: { contains: q, mode: "insensitive" } },
      { modello: { contains: q, mode: "insensitive" } },
      { matricola: { contains: q, mode: "insensitive" } },
      { note: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.plant.findMany({
    where,
    include: {
      client: { select: { id: true, nome: true, cognome: true, ragioneSociale: true, citta: true } },
      _count: { select: { interventi: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  return NextResponse.json(rows.map(serializePlant));
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

  const tipologia = parseTipo(body.tipologia) ?? "STUFA";
  const anno =
    typeof body.annoInstallazione === "number"
      ? body.annoInstallazione
      : body.annoInstallazione
        ? parseInt(String(body.annoInstallazione), 10)
        : null;

  const plant = await prisma.plant.create({
    data: {
      organizationId: session!.organizationId,
      clientId,
      marca: typeof body.marca === "string" && body.marca.trim() ? body.marca.trim() : null,
      modello: typeof body.modello === "string" && body.modello.trim() ? body.modello.trim() : null,
      matricola: typeof body.matricola === "string" && body.matricola.trim() ? body.matricola.trim() : null,
      tipologia,
      annoInstallazione: anno && !Number.isNaN(anno) ? anno : null,
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 2000) : null,
    },
    include: {
      client: { select: { id: true, nome: true, cognome: true, ragioneSociale: true, citta: true } },
      _count: { select: { interventi: true } },
    },
  });

  if (plant.marca || plant.modello) {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        marcaStufa: plant.marca ?? undefined,
        modelloStufa: plant.modello ?? undefined,
      },
    });
  }

  return NextResponse.json(serializePlant(plant), { status: 201 });
}
