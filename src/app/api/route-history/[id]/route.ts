import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, orgScope } from "@/lib/tenant";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: "ID non valido" }, { status: 400 });
  }

  try {
    const existing = await prisma.routeHistory.findFirst({
      where: { id: numId, ...orgScope(session!.organizationId) },
    });
    if (!existing) {
      return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    }
    await prisma.routeHistory.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  }
}
