import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireSession, requireOperator, orgScope, assertClientInOrg } from "@/lib/tenant";

const MAX_SIZE = 15 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

function uploadsDir() {
  return path.join(process.cwd(), "uploads", "client-docs");
}

function serialize(doc: {
  id: number;
  clientId: number;
  title: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}) {
  return {
    id: doc.id,
    clientId: doc.clientId,
    title: doc.title,
    filename: doc.filename,
    mimeType: doc.mimeType,
    size: doc.size,
    createdAt: doc.createdAt.toISOString(),
    url: `/api/documents/${doc.id}/file`,
  };
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const clientId = parseInt(req.nextUrl.searchParams.get("clientId") ?? "", 10);
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "clientId obbligatorio" }, { status: 400 });
  }

  const rows = await prisma.clientDocument.findMany({
    where: { ...orgScope(session!.organizationId), clientId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rows.map(serialize));
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireOperator();
  if (error) return error;

  const form = await req.formData();
  const clientId = parseInt(String(form.get("clientId") ?? ""), 10);
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "Cliente mancante" }, { status: 400 });
  }
  if (!(await assertClientInOrg(clientId, session!.organizationId))) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File mancante" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File troppo grande (max 15 MB)" }, { status: 400 });
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: "Tipo file non supportato" }, { status: 400 });
  }

  const titleRaw = String(form.get("title") ?? "").trim();
  const filename = file.name.replace(/[^\w.\- ()àèéìòùÀÈÉÌÒÙ]+/g, "_").slice(0, 180) || "documento";
  const ext = path.extname(filename) || "";
  const storageKey = `${randomBytes(12).toString("hex")}${ext}`;

  await mkdir(uploadsDir(), { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir(), storageKey), buf);

  const doc = await prisma.clientDocument.create({
    data: {
      organizationId: session!.organizationId,
      clientId,
      title: titleRaw || filename,
      filename,
      mimeType: mime,
      size: file.size,
      storageKey,
    },
  });

  return NextResponse.json(serialize(doc), { status: 201 });
}
