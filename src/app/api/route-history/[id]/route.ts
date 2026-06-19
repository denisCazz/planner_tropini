import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: "ID non valido" }, { status: 400 });
  }

  try {
    await prisma.routeHistory.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  }
}
