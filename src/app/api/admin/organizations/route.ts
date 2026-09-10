import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";

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

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  return NextResponse.json(
    { error: "Tropini Service è l'unica società: la creazione di nuovi tenant è disabilitata." },
    { status: 403 }
  );
}
