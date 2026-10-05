import { NextRequest, NextResponse } from "next/server";
import { requireOperator } from "@/lib/tenant";
import { parsePlanningCommand } from "@/lib/plan-parse";
import { createPlans, PLAN_INCLUDE, technicianNames } from "@/lib/planner";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { session, error } = await requireOperator();
  if (error || !session) return error;
  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "Scrivi cosa vuoi pianificare" }, { status: 400 });
  try {
    const names = await technicianNames(session.organizationId);
    const parsed = await parsePlanningCommand(text, names);
    if (parsed.assignments.length === 0) {
      return NextResponse.json({ messaggio: parsed.messaggio, batchId: null, plans: [], warnings: [] });
    }
    const result = await createPlans(session.organizationId, parsed.assignments);
    const plans = await prisma.plan.findMany({
      where: { id: { in: result.planIds }, organizationId: session.organizationId },
      include: PLAN_INCLUDE,
      orderBy: [{ data: "asc" }, { id: "asc" }],
    });
    return NextResponse.json({ messaggio: parsed.messaggio, batchId: result.batchId, plans, warnings: result.warnings });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore" }, { status: 500 });
  }
}
