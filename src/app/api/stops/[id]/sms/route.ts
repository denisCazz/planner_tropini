import { NextRequest, NextResponse } from "next/server";
import { requireOperator } from "@/lib/tenant";
import { availabilitySmsText, getPlan, sendAvailabilitySms } from "@/lib/planner";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireOperator();
  if (error || !session) return error;
  const { id } = await params;
  const pack = await availabilitySmsText(Number(id), session.organizationId);
  if (!pack) return NextResponse.json({ error: "Tappa non trovata" }, { status: 404 });
  return NextResponse.json({ text: pack.text });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireOperator();
  if (error || !session) return error;
  const { id } = await params;
  try {
    const { to, planId } = await sendAvailabilitySms(Number(id), session.organizationId);
    return NextResponse.json({ to, plan: await getPlan(planId, session.organizationId) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore" }, { status: 400 });
  }
}
