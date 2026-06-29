import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";
import { hashPassword } from "@/lib/password";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "societa";
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const orgs = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { clients: true, users: true } },
    },
  });

  return NextResponse.json(
    orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      isDemo: o.isDemo,
      clientCount: o._count.clients,
      userCount: o._count.users,
      createdAt: o.createdAt.toISOString(),
    }))
  );
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name) {
    return NextResponse.json({ error: "Nome società obbligatorio" }, { status: 400 });
  }

  let slug = slugify(name);
  const existingSlug = await prisma.organization.findUnique({ where: { slug } });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      settings: { create: {} },
    },
  });

  if (username && password) {
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password utente troppo corta (min 6 caratteri)" },
        { status: 400 }
      );
    }
    await prisma.user.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        role: "USER",
        organizationId: org.id,
      },
    });
  }

  return NextResponse.json(org, { status: 201 });
}
