import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireAdmin, orgScope } from "@/lib/tenant";
import { hashPassword } from "@/lib/password";
import { parseUserRole } from "@/lib/roles";

// Elenco tecnici/utenti dell'organizzazione, per assegnazioni e filtri "vista per tecnico".
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const users = await prisma.user.findMany({
    where: orgScope(session!.organizationId),
    select: {
      id: true,
      username: true,
      role: true,
      nome: true,
      cognome: true,
      telefono: true,
      email: true,
      attivo: true,
      note: true,
      workingHours: true,
      _count: { select: { assignedClients: true, interventi: true } },
    },
    orderBy: { username: "asc" },
  });

  return NextResponse.json(
    users.map(({ _count, ...u }) => ({
      ...u,
      assignedClientCount: _count.assignedClients,
      interventiCount: _count.interventi,
    }))
  );
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = parseUserRole(body.role) ?? "USER";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username e password obbligatori" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password troppo corta (min 6 caratteri)" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "Username già in uso" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      role,
      organizationId: session!.organizationId,
      nome: typeof body.nome === "string" ? body.nome.trim() || null : null,
      cognome: typeof body.cognome === "string" ? body.cognome.trim() || null : null,
      telefono: typeof body.telefono === "string" ? body.telefono.trim() || null : null,
      email: typeof body.email === "string" ? body.email.trim() || null : null,
      note: typeof body.note === "string" ? body.note.trim() || null : null,
    },
    select: {
      id: true,
      username: true,
      role: true,
      nome: true,
      cognome: true,
      telefono: true,
      email: true,
      attivo: true,
      note: true,
    },
  });

  return NextResponse.json({ ...user, assignedClientCount: 0 }, { status: 201 });
}
