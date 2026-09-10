import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const docId = parseInt(id, 10);
  if (Number.isNaN(docId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }

  const doc = await prisma.clientDocument.findFirst({
    where: { id: docId, organizationId: session!.organizationId },
  });
  if (!doc) return NextResponse.json({ error: "Documento non trovato" }, { status: 404 });

  await prisma.clientDocument.delete({ where: { id: docId } });
  try {
    await unlink(path.join(process.cwd(), "uploads", "client-docs", doc.storageKey));
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true });
}
