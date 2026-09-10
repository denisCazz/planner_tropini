import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, orgScope } from "@/lib/tenant";
import { parseDateKey } from "@/lib/dates";

const CATEGORIE = [
  "CARBURANTE",
  "RICAMBI",
  "ATTREZZATURA",
  "PEDAGGI",
  "ALLOGGIO",
  "MARKETING",
  "VARIE",
] as const;

function serializeSpesa(s: {
  id: number;
  data: Date;
  categoria: (typeof CATEGORIE)[number];
  importo: unknown;
  descrizione: string | null;
}) {
  return {
    id: s.id,
    data: s.data.toISOString().slice(0, 10),
    categoria: s.categoria,
    importo: Number(s.importo),
    descrizione: s.descrizione,
  };
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const from = parseDateKey(searchParams.get("from"));
  const to = parseDateKey(searchParams.get("to"));

  const where: Record<string, unknown> = { ...orgScope(session!.organizationId) };
  if (from && to) {
    where.data = { gte: from, lt: new Date(to.getTime() + 86400000) };
  } else if (from) {
    where.data = { gte: from };
  } else if (to) {
    where.data = { lt: new Date(to.getTime() + 86400000) };
  }

  const spese = await prisma.spesa.findMany({
    where,
    orderBy: { data: "desc" },
    take: 500,
  });

  return NextResponse.json(spese.map(serializeSpesa));
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const data = parseDateKey(b.data);
  if (!data) {
    return NextResponse.json({ error: "Data non valida" }, { status: 400 });
  }

  const importo = typeof b.importo === "number" ? b.importo : parseFloat(String(b.importo ?? ""));
  if (Number.isNaN(importo) || importo <= 0) {
    return NextResponse.json({ error: "Importo non valido" }, { status: 400 });
  }

  const categoria = CATEGORIE.includes(b.categoria as (typeof CATEGORIE)[number])
    ? (b.categoria as (typeof CATEGORIE)[number])
    : "VARIE";

  const descrizione = typeof b.descrizione === "string" && b.descrizione.trim() ? b.descrizione.trim().slice(0, 2000) : null;

  const spesa = await prisma.spesa.create({
    data: {
      organizationId: session!.organizationId,
      data,
      categoria,
      importo,
      descrizione,
    },
  });

  return NextResponse.json(serializeSpesa(spesa), { status: 201 });
}
