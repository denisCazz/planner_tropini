import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/tenant";
import { getPlan, sendAvailabilitySms } from "@/lib/planner";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireOperator();
  if (error || !session) return error;
  const { id } = await params;
  const planId = Number(id);
  const stops = await prisma.planStop.findMany({
    where: { planId, plan: { organizationId: session.organizationId }, status: { in: ["DA_CHIAMARE", "NESSUNA_RISPOSTA"] } },
  });
  let sent = 0;
  const errors: string[] = [];
  for (const s of stops) {
    try {
      await sendAvailabilitySms(s.id, session.organizationId);
      sent++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Errore");
    }
  }
  return NextResponse.json({ sent, errors, plan: await getPlan(planId, session.organizationId) });
}
