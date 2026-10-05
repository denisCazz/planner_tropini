import { NextRequest, NextResponse } from "next/server";
import { requireOperator } from "@/lib/tenant";
import { addStop, getPlan } from "@/lib/planner";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireOperator();
  if (error || !session) return error;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { clientId?: number };
  const stop = await addStop(Number(id), session.organizationId, body.clientId);
  if (!stop) return NextResponse.json({ error: "Nessun altro cliente in zona" }, { status: 404 });
  return NextResponse.json({ plan: await getPlan(Number(id), session.organizationId) });
}
