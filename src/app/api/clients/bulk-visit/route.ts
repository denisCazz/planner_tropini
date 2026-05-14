import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientIds, visitedAt } = body as {
    clientIds?: unknown;
    visitedAt?: string | null;
  };

  if (!Array.isArray(clientIds) || clientIds.length === 0) {
    return NextResponse.json(
      { error: "clientIds richiesto (array non vuoto)" },
      { status: 400 }
    );
  }

  const ids = clientIds
    .map((id) => Number(id))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Nessun id valido" }, { status: 400 });
  }

  const date =
    visitedAt && typeof visitedAt === "string"
      ? new Date(visitedAt)
      : new Date();

  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Data non valida" }, { status: 400 });
  }

  const result = await prisma.client.updateMany({
    where: { id: { in: ids } },
    data: { ultimaVisita: date },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
