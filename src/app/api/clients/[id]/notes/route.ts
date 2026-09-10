import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, assertClientInOrg } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function serialize(n: {
  id: number;
  clientId: number | null;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: Date;
}) {
  return {
    id: n.id,
    clientId: n.clientId,
    authorId: n.authorId,
    authorName: n.authorName,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const clientId = parseInt(id, 10);
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }
  if (!(await assertClientInOrg(clientId, session!.organizationId))) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const notes = await prisma.clientNote.findMany({
    where: { clientId, organizationId: session!.organizationId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(notes.map(serialize));
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const clientId = parseInt(id, 10);
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }
  if (!(await assertClientInOrg(clientId, session!.organizationId))) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const body = await req.json();
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Nota vuota" }, { status: 400 });
  }

  const note = await prisma.clientNote.create({
    data: {
      organizationId: session!.organizationId,
      clientId,
      authorId: session!.userId,
      authorName: session!.username,
      body: text.slice(0, 4000),
    },
  });

  return NextResponse.json(serialize(note), { status: 201 });
}
