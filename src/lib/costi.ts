import { prisma } from "./prisma";
import { personName } from "./share";
import { currentFuelPrice, fuelCostEuro } from "./fuel";

export async function summarizeCosts(
  organizationId: string,
  from: Date,
  to: Date,
  technicianId?: string,
  refreshPrice = false
) {
  const [plans, spese, fuel] = await Promise.all([
    prisma.plan.findMany({
      where: {
        organizationId,
        status: { in: ["PRONTO", "INVIATO"] },
        data: { gte: from, lt: to },
        ...(technicianId ? { technicianId } : {}),
      },
      include: {
        technician: { select: { id: true, nome: true, cognome: true, username: true } },
        stops: { where: { status: { not: "NON_DISPONIBILE" } }, select: { id: true } },
      },
      orderBy: [{ data: "asc" }, { id: "asc" }],
    }),
    prisma.spesa.findMany({
      where: { organizationId, data: { gte: from, lt: to } },
      orderBy: { data: "desc" },
    }),
    currentFuelPrice(organizationId, refreshPrice),
  ]);

  const movimenti = plans.map((plan) => {
    const km = plan.totalDistance ?? 0;
    return {
      id: plan.id,
      data: plan.data.toISOString().slice(0, 10),
      technicianId: plan.technician.id,
      technician: personName(plan.technician),
      zona: plan.zona,
      tappe: plan.stops.length,
      km,
      minuti: plan.totalDuration,
      carburante: fuelCostEuro(km, fuel.consumoL100, fuel.price),
    };
  });

  const speseOut = spese.map((s) => ({
    id: s.id,
    data: s.data.toISOString().slice(0, 10),
    categoria: s.categoria,
    importo: Number(s.importo),
    descrizione: s.descrizione,
  }));

  const km = Math.round(movimenti.reduce((sum, m) => sum + m.km, 0) * 10) / 10;
  const carburante = Math.round(movimenti.reduce((sum, m) => sum + m.carburante, 0) * 100) / 100;
  const speseTot = Math.round(speseOut.reduce((sum, s) => sum + s.importo, 0) * 100) / 100;

  return {
    movimenti,
    spese: speseOut,
    fuel,
    totali: {
      km,
      carburante,
      spese: speseTot,
      totale: Math.round((carburante + speseTot) * 100) / 100,
    },
  };
}
