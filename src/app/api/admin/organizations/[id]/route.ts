import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) {
    return NextResponse.json({ error: "Società non trovata" }, { status: 404 });
  }
  if (org.isDemo) {
    return NextResponse.json(
      { error: "La società demo non può essere eliminata" },
      { status: 400 }
    );
  }

  await prisma.organization.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
