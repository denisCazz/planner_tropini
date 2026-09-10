import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, orgScope } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const clientId = parseInt(searchParams.get("clientId") ?? "", 10);
  const plantId = parseInt(searchParams.get("plantId") ?? "", 10);
  const interventoId = parseInt(searchParams.get("interventoId") ?? "", 10);

  const where: Record<string, unknown> = { ...orgScope(session!.organizationId) };
  if (!Number.isNaN(clientId)) where.clientId = clientId;
  else if (!Number.isNaN(plantId)) where.plantId = plantId;
  else if (!Number.isNaN(interventoId)) where.interventoId = interventoId;
  else return NextResponse.json({ error: "Specifica clientId, plantId o interventoId" }, { status: 400 });

  const notes = await prisma.clientNote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Nota vuota" }, { status: 400 });

  const clientId = body.clientId != null ? parseInt(String(body.clientId), 10) : null;
  const plantId = body.plantId != null ? parseInt(String(body.plantId), 10) : null;
  const interventoId = body.interventoId != null ? parseInt(String(body.interventoId), 10) : null;
  const filled = [clientId, plantId, interventoId].filter((v) => v != null && !Number.isNaN(v));
  if (filled.length !== 1) {
    return NextResponse.json({ error: "Una nota deve appartenere a una sola entità" }, { status: 400 });
  }

  const note = await prisma.clientNote.create({
    data: {
      organizationId: session!.organizationId,
      clientId: clientId && !Number.isNaN(clientId) ? clientId : null,
      plantId: plantId && !Number.isNaN(plantId) ? plantId : null,
      interventoId: interventoId && !Number.isNaN(interventoId) ? interventoId : null,
      authorId: session!.userId,
      authorName: session!.username,
      body: text.slice(0, 4000),
    },
  });
  return NextResponse.json(note, { status: 201 });
}
