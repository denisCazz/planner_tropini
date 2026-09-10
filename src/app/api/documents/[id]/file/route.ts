import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireSession();
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

  const filePath = path.join(process.cwd(), "uploads", "client-docs", doc.storageKey);
  let buf: Buffer;
  try {
    buf = await readFile(filePath);
  } catch {
    return NextResponse.json({ error: "File non disponibile" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.filename)}"`,
      "Content-Length": String(buf.length),
    },
  });
}
