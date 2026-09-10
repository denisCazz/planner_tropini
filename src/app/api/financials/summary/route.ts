import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, orgScope } from "@/lib/tenant";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("it-IT", { month: "short" });
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const mesi = Math.max(1, Math.min(24, parseInt(searchParams.get("mesi") ?? "6", 10)));
  const org = orgScope(session!.organizationId);

  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - (mesi - 1));
  from.setDate(1);
  from.setHours(0, 0, 0, 0);

  const [interventi, spese, technicians] = await Promise.all([
    prisma.intervento.findMany({
      where: { ...org, data: { gte: from } },
      select: {
        data: true,
        ricavo: true,
        technicianId: true,
        technician: { select: { username: true } },
      },
    }),
    prisma.spesa.findMany({
      where: { ...org, data: { gte: from } },
      select: { data: true, categoria: true, importo: true },
    }),
    prisma.user.findMany({
      where: org,
      select: { id: true, username: true },
    }),
  ]);

  const monthKeys: string[] = [];
  for (let i = mesi - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    monthKeys.push(monthKey(d));
  }

  const perMeseMap = new Map(
    monthKeys.map((k) => [k, { mese: monthLabel(k), ricavi: 0, spese: 0, netto: 0, interventi: 0 }])
  );

  let ricavi = 0;
  let interventiCount = interventi.length;
  for (const i of interventi) {
    const r = Number(i.ricavo);
    ricavi += r;
    const key = i.data ? monthKey(i.data) : "";
    const bucket = perMeseMap.get(key);
    if (bucket) {
      bucket.ricavi += r;
      bucket.interventi += 1;
    }
  }

  let speseTot = 0;
  const perCategoriaMap = new Map<string, number>();
  for (const s of spese) {
    const imp = Number(s.importo);
    speseTot += imp;
    const key = monthKey(s.data);
    const bucket = perMeseMap.get(key);
    if (bucket) bucket.spese += imp;
    perCategoriaMap.set(s.categoria, (perCategoriaMap.get(s.categoria) ?? 0) + imp);
  }

  for (const bucket of perMeseMap.values()) {
    bucket.netto = bucket.ricavi - bucket.spese;
  }

  const techNames = new Map(technicians.map((t) => [t.id, t.username]));
  const perTecnicoMap = new Map<string | null, { ricavi: number; interventi: number }>();
  for (const i of interventi) {
    const key = i.technicianId ?? null;
    const entry = perTecnicoMap.get(key) ?? { ricavi: 0, interventi: 0 };
    entry.ricavi += Number(i.ricavo);
    entry.interventi += 1;
    perTecnicoMap.set(key, entry);
  }
  const perTecnico = [...perTecnicoMap.entries()]
    .map(([technicianId, v]) => ({
      technicianId,
      technicianName: technicianId ? (techNames.get(technicianId) ?? "—") : "Non assegnato",
      ricavi: v.ricavi,
      interventi: v.interventi,
    }))
    .sort((a, b) => b.ricavi - a.ricavi);

  const perCategoria = [...perCategoriaMap.entries()]
    .map(([categoria, totale]) => ({ categoria, totale }))
    .sort((a, b) => b.totale - a.totale);

  return NextResponse.json({
    ricavi,
    spese: speseTot,
    netto: ricavi - speseTot,
    interventi: interventiCount,
    perMese: monthKeys.map((k) => perMeseMap.get(k)!),
    perTecnico,
    perCategoria,
  });
}
