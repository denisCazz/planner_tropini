import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const availId = parseInt(id, 10);
  if (Number.isNaN(availId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }

  const existing = await prisma.customerAvailability.findFirst({
    where: { id: availId, organizationId: session!.organizationId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Disponibilità non trovata" }, { status: 404 });
  }

  await prisma.customerAvailability.delete({ where: { id: availId } });
  return NextResponse.json({ ok: true });
}
