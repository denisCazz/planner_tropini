import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/tenant";
import { parseDateKey } from "@/lib/dates";
import { summarizeCosts } from "@/lib/costi";

function monthRange(ym: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!match) return null;
  const from = parseDateKey(`${match[1]}-${match[2]}-01`);
  if (!from) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const to = parseDateKey(next);
  if (!to) return null;
  return { from, to };
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  const month = req.nextUrl.searchParams.get("month") ?? "";
  const range = monthRange(month);
  if (!range) return NextResponse.json({ error: "Mese non valido" }, { status: 400 });
  const technicianId = req.nextUrl.searchParams.get("technicianId") || undefined;
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const summary = await summarizeCosts(session!.organizationId, range.from, range.to, technicianId, refresh);
  return NextResponse.json(summary);
}
