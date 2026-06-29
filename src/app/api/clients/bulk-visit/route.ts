import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, orgScope } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

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
    where: { id: { in: ids }, ...orgScope(session!.organizationId) },
    data: { ultimaVisita: date },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
