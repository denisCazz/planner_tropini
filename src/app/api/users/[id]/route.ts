import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, requireAdmin, assertUserInOrg } from "@/lib/tenant";
import { hashPassword } from "@/lib/password";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface WorkingHoursSlot {
  day: number;
  start: string;
  end: string;
}

function parseWorkingHours(raw: unknown): WorkingHoursSlot[] | null {
  if (raw === null) return [];
  if (!Array.isArray(raw) || raw.length > 7) return null;
  const slots: WorkingHoursSlot[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return null;
    const s = item as Record<string, unknown>;
    const day = typeof s.day === "number" ? Math.round(s.day) : NaN;
    if (!(day >= 1 && day <= 7)) return null;
    if (typeof s.start !== "string" || !/^\d{1,2}:\d{2}$/.test(s.start)) return null;
    if (typeof s.end !== "string" || !/^\d{1,2}:\d{2}$/.test(s.end)) return null;
    slots.push({ day, start: s.start, end: s.end });
  }
  return slots;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const isAdmin = session!.role === "ADMIN";
  const isSelf = id === session!.userId;
  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  const target = await assertUserInOrg(id, session!.organizationId);
  if (!target) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }

  const body = await req.json();
  const data: Prisma.UserUpdateInput = {};

  if (isAdmin && (body.role === "ADMIN" || body.role === "USER" || body.role === "TECNICO" || body.role === "OPERATORE")) {
    data.role = body.role === "OPERATORE" ? "USER" : body.role;
  }
  if (typeof body.nome === "string") data.nome = body.nome.trim() || null;
  if (typeof body.cognome === "string") data.cognome = body.cognome.trim() || null;
  if (typeof body.telefono === "string") data.telefono = body.telefono.trim() || null;
  if (typeof body.email === "string") data.email = body.email.trim() || null;
  if (typeof body.note === "string") data.note = body.note.trim() || null;
  if (typeof body.attivo === "boolean" && isAdmin) data.attivo = body.attivo;

  if (isAdmin && typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 6) {
      return NextResponse.json(
        { error: "Password troppo corta (min 6 caratteri)" },
        { status: 400 }
      );
    }
    data.passwordHash = hashPassword(body.password);
  }

  if (body.workingHours !== undefined) {
    const hours = parseWorkingHours(body.workingHours);
    if (!hours) {
      return NextResponse.json(
        { error: "Orari non validi (formato: [{day:1-7, start:'HH:MM', end:'HH:MM'}])" },
        { status: 400 }
      );
    }
    data.workingHours =
      hours.length === 0
        ? Prisma.DbNull
        : (hours as unknown as Prisma.InputJsonValue);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  if (isAdmin && data.role === "USER" && target.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { organizationId: session!.organizationId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Impossibile rimuovere l'ultimo amministratore" },
        { status: 400 }
      );
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data,
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
      _count: { select: { assignedClients: true } },
    },
  });

  return NextResponse.json({
    id: user.id,
    username: user.username,
    role: user.role,
    nome: user.nome,
    cognome: user.cognome,
    telefono: user.telefono,
    email: user.email,
    attivo: user.attivo,
    note: user.note,
    workingHours: user.workingHours,
    assignedClientCount: user._count.assignedClients,
  });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  if (id === session!.userId) {
    return NextResponse.json(
      { error: "Non puoi eliminare il tuo account" },
      { status: 400 }
    );
  }

  const target = await assertUserInOrg(id, session!.organizationId);
  if (!target) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }

  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { organizationId: session!.organizationId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Impossibile eliminare l'ultimo amministratore" },
        { status: 400 }
      );
    }
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
