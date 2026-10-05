import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/tenant";
import { getPlan, markUnavailable, planIsLocked } from "@/lib/planner";
import type { StopStatus } from "@prisma/client";

const STATUSES: StopStatus[] = ["DA_CHIAMARE", "SMS_INVIATO", "CONFERMATO", "NON_DISPONIBILE", "NESSUNA_RISPOSTA"];

async function ownedStop(id: number, organizationId: string) {
  return prisma.planStop.findFirst({
    where: { id, plan: { organizationId } },
    include: { plan: { select: { status: true } } },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireOperator();
  if (error || !session) return error;
  const { id } = await params;
  const stopId = Number(id);
  const existing = await ownedStop(stopId, session.organizationId);
  if (!existing) return NextResponse.json({ error: "Tappa non trovata" }, { status: 404 });
  if (planIsLocked(existing.plan.status)) {
    return NextResponse.json({ error: "Giornata già confermata" }, { status: 409 });
  }
  const body = (await req.json()) as { status?: StopStatus; orario?: string | null; note?: string | null; replace?: boolean };
  if (body.status && !STATUSES.includes(body.status)) return NextResponse.json({ error: "Stato non valido" }, { status: 400 });

  let replacement = null;
  if (body.status === "NON_DISPONIBILE" && existing.status !== "NON_DISPONIBILE") {
    const result = await markUnavailable(stopId, session.organizationId, body.replace !== false);
    replacement = result?.replacement ?? null;
  } else if (body.status) {
    await prisma.planStop.update({ where: { id: stopId }, data: { status: body.status } });
  }
  if (body.orario !== undefined || body.note !== undefined) {
    await prisma.planStop.update({
      where: { id: stopId },
      data: {
        ...(body.orario !== undefined && { orario: body.orario || null }),
        ...(body.note !== undefined && { note: body.note || null }),
      },
    });
  }
  return NextResponse.json({ replacement, plan: await getPlan(existing.planId, session.organizationId) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireOperator();
  if (error || !session) return error;
  const { id } = await params;
  const stop = await ownedStop(Number(id), session.organizationId);
  if (!stop) return NextResponse.json({ error: "Tappa non trovata" }, { status: 404 });
  if (planIsLocked(stop.plan.status)) {
    return NextResponse.json({ error: "Giornata già confermata" }, { status: 409 });
  }
  await prisma.planStop.delete({ where: { id: stop.id } });
  return NextResponse.json({ plan: await getPlan(stop.planId, session.organizationId) });
}
