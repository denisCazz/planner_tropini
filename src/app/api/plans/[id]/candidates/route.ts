import { NextRequest, NextResponse } from "next/server";
import { requireOperator } from "@/lib/tenant";
import { planCandidates } from "@/lib/planner";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireOperator();
  if (error || !session) return error;
  const { id } = await params;
  const list = await planCandidates(Number(id), session.organizationId, 10);
  return NextResponse.json(list.map((c) => ({ client: c.client, score: c.score, distanzaKm: c.distanzaKm, motivi: c.motivi })));
}
