import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/tenant";
import { getPlan } from "@/lib/planner";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireOperator();
  if (error || !session) return error;
  const { id } = await params;
  const plan = await getPlan(Number(id), session.organizationId);
  if (!plan) return NextResponse.json({ error: "Piano non trovato" }, { status: 404 });
  return NextResponse.json(plan);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireOperator();
  if (error || !session) return error;
  const { id } = await params;
  const plan = await prisma.plan.findFirst({ where: { id: Number(id), organizationId: session.organizationId } });
  if (!plan) return NextResponse.json({ error: "Piano non trovato" }, { status: 404 });
  await prisma.plan.delete({ where: { id: plan.id } });
  return NextResponse.json({ ok: true });
}
