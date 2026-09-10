import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string; noteId: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { noteId } = await params;
  const nId = parseInt(noteId, 10);
  if (Number.isNaN(nId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }

  const note = await prisma.clientNote.findFirst({
    where: { id: nId, organizationId: session!.organizationId },
    select: { id: true },
  });
  if (!note) {
    return NextResponse.json({ error: "Nota non trovata" }, { status: 404 });
  }

  await prisma.clientNote.delete({ where: { id: nId } });
  return NextResponse.json({ ok: true });
}
