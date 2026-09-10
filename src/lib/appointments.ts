import { prisma } from "@/lib/prisma";

const MINUTES_PER_DAY = 24 * 60;

export function isValidAppointmentWindow(startMin: number, durationMin: number): boolean {
  return (
    Number.isInteger(startMin) &&
    Number.isInteger(durationMin) &&
    startMin >= 0 &&
    durationMin >= 5 &&
    startMin + durationMin <= MINUTES_PER_DAY
  );
}

type ConflictInput = {
  organizationId: string;
  technicianId: string | null;
  date: Date;
  startMin: number;
  durationMin: number;
  excludeId?: number;
};

/** Restituisce l'appuntamento sovrapposto dello stesso tecnico, se esiste. */
export async function findAppointmentConflict({
  organizationId,
  technicianId,
  date,
  startMin,
  durationMin,
  excludeId,
}: ConflictInput) {
  // Gli appuntamenti senza tecnico sono volutamente ammessi in parallelo.
  if (!technicianId) return null;

  const existing = await prisma.appointment.findMany({
    where: {
      organizationId,
      technicianId,
      date,
      stato: { not: "ANNULLATO" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, startMin: true, durationMin: true },
  });

  const endMin = startMin + durationMin;
  return (
    existing.find(
      (appointment) =>
        appointment.startMin < endMin &&
        startMin < appointment.startMin + appointment.durationMin
    ) ?? null
  );
}
