import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";
import { hashPassword } from "@/lib/password";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await prisma.user.findMany({
    orderBy: [{ organization: { name: "asc" } }, { username: "asc" }],
    include: {
      organization: { select: { id: true, name: true, slug: true } },
    },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      organizationId: u.organizationId,
      organizationName: u.organization?.name ?? null,
      createdAt: u.createdAt.toISOString(),
    }))
  );
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const organizationId =
    typeof body.organizationId === "string" ? body.organizationId.trim() : "";
  const role = body.role === "ADMIN" ? "ADMIN" : "USER";

  if (!username || !password || !organizationId) {
    return NextResponse.json(
      { error: "Username, password e società obbligatori" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password troppo corta (min 6 caratteri)" },
      { status: 400 }
    );
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) {
    return NextResponse.json({ error: "Società non trovata" }, { status: 404 });
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
      organizationId,
    },
  });

  return NextResponse.json(
    { id: user.id, username: user.username, role: user.role, organizationId },
    { status: 201 }
  );
}
