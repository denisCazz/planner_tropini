import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const spesaId = parseInt(id, 10);
  if (Number.isNaN(spesaId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }

  const found = await prisma.spesa.findFirst({
    where: { id: spesaId, organizationId: session!.organizationId },
    select: { id: true },
  });
  if (!found) {
    return NextResponse.json({ error: "Spesa non trovata" }, { status: 404 });
  }

  await prisma.spesa.delete({ where: { id: spesaId } });
  return NextResponse.json({ ok: true });
}
