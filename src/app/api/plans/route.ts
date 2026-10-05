import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/tenant";
import { PLAN_INCLUDE } from "@/lib/planner";
import { parseDateKey } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const { session, error } = await requireOperator();
  if (error || !session) return error;
  const sp = req.nextUrl.searchParams;
  const batchId = sp.get("batchId");
  const from = sp.get("from");
  const to = sp.get("to");
  const where = {
    organizationId: session.organizationId,
    ...(batchId
      ? { batchId }
      : {
          data: {
            ...(from && parseDateKey(from) ? { gte: parseDateKey(from)! } : {}),
            ...(to && parseDateKey(to) ? { lte: parseDateKey(to)! } : {}),
          },
        }),
  };
  const plans = await prisma.plan.findMany({
    where,
    include: PLAN_INCLUDE,
    orderBy: [{ data: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(plans);
}
