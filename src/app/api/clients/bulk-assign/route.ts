import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOperator, orgScope, resolveAssignedUser, INVALID_ASSIGNEE } from "@/lib/tenant";

// Assegna in blocco un tecnico (o nessuno) a più clienti, per la gestione delle tratte per tecnico.
export async function POST(req: NextRequest) {
  const { session, error } = await requireOperator();
  if (error) return error;

  const body = await req.json();
  const { scope, assignedUserId, clientIds } = body as {
    scope?: unknown;
    assignedUserId?: unknown;
    clientIds?: unknown;
  };

  const assignedId = await resolveAssignedUser(assignedUserId, session!.organizationId);
  if (assignedId === INVALID_ASSIGNEE) {
    return NextResponse.json({ error: "Tecnico non valido" }, { status: 400 });
  }

  const org = orgScope(session!.organizationId);

  if (scope === "all") {
    const result = await prisma.client.updateMany({
      where: org,
      data: { assignedUserId: assignedId },
    });
    return NextResponse.json({ ok: true, updated: result.count });
  }

  if (scope === "selected") {
    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return NextResponse.json(
        { error: "clientIds richiesto per scope selected" },
        { status: 400 }
      );
    }

    const ids = clientIds
      .map((id) => Number(id))
      .filter((n) => Number.isInteger(n) && n > 0);

    if (ids.length === 0) {
      return NextResponse.json({ error: "Nessun id valido" }, { status: 400 });
    }

    const result = await prisma.client.updateMany({
      where: { id: { in: ids }, ...org },
      data: { assignedUserId: assignedId },
    });

    return NextResponse.json({ ok: true, updated: result.count });
  }

  return NextResponse.json({ error: "scope non valido" }, { status: 400 });
}
