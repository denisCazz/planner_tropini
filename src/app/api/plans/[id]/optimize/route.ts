import { NextRequest, NextResponse } from "next/server";
import { requireOperator } from "@/lib/tenant";
import { optimizePlan } from "@/lib/planner";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireOperator();
  if (error || !session) return error;
  const { id } = await params;
  try {
    return NextResponse.json(await optimizePlan(Number(id), session.organizationId));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore" }, { status: 500 });
  }
}
