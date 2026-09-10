export function nextFreeStartMin(
  existing: { startMin: number; durationMin: number }[],
  durationMin: number,
  workStart = 8 * 60,
  step = 15,
  workEnd = 18 * 60
): number | null {
  const busy = [...existing]
    .filter((a) => a.durationMin > 0)
    .sort((a, b) => a.startMin - b.startMin);

  let t = workStart;
  for (const a of busy) {
    if (t + durationMin <= a.startMin && t + durationMin <= workEnd) return t;
    t = Math.max(t, a.startMin + a.durationMin);
    t = Math.ceil(t / step) * step;
  }
  return t + durationMin <= workEnd ? t : null;
}

export type PackStop = {
  interventoId: number;
  clientId: number;
  durationMin: number;
  lat: number | null;
  lng: number | null;
  reason: string;
};

export function packDay(
  existing: { startMin: number; durationMin: number }[],
  candidates: PackStop[],
  workStart = 8 * 60
): { interventoId: number; clientId: number; startMin: number; durationMin: number; reason: string }[] {
  const result: {
    interventoId: number;
    clientId: number;
    startMin: number;
    durationMin: number;
    reason: string;
  }[] = [];
  const occupied = [...existing];
  let prev: { lat: number | null; lng: number | null } | null = null;

  const remaining = [...candidates];
  while (remaining.length > 0) {
    remaining.sort((a, b) => {
      if (!prev || prev.lat == null || prev.lng == null) return 0;
      const da = dist(prev, a);
      const db = dist(prev, b);
      return da - db;
    });
    const next = remaining.shift()!;
    const startMin = nextFreeStartMin(occupied, next.durationMin, workStart);
    if (startMin == null) break;
    occupied.push({ startMin, durationMin: next.durationMin });
    result.push({
      interventoId: next.interventoId,
      clientId: next.clientId,
      startMin,
      durationMin: next.durationMin,
      reason: next.reason,
    });
    prev = { lat: next.lat, lng: next.lng };
  }
  return result;
}

function dist(
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null }
): number {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return 9999;
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}
