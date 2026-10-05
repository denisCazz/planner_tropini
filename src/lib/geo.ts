export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1) * Math.PI / 180) *
      Math.cos((lat2) * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function inRadius(
  origin: { lat: number; lng: number },
  point: { lat: number | null; lng: number | null },
  km: number
): boolean {
  if (point.lat == null || point.lng == null) return false;
  return haversineKm(origin.lat, origin.lng, point.lat, point.lng) <= km;
}

export type GeoBox = { south: number; west: number; north: number; east: number };

const zoneCache = new Map<string, { lat: number; lng: number; label: string } | null>();
let lastZoneLookup = 0;

/** Geocodifica un comune (es. "Revello"), prima in Piemonte. */
export async function geocodeZone(zone: string) {
  const key = zone.trim().toLowerCase();
  if (zoneCache.has(key)) return zoneCache.get(key)!;
  const queries = [`${zone}, Piemonte, Italia`, `${zone}, Italia`];
  for (const q of queries) {
    const wait = lastZoneLookup + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastZoneLookup = Date.now();
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "it");
    const res = await fetch(url, { headers: { "User-Agent": "PlannerTropini/2.0" } });
    if (!res.ok) continue;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (data[0]) {
      const found = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name.split(",")[0] };
      zoneCache.set(key, found);
      return found;
    }
  }
  zoneCache.set(key, null);
  return null;
}

export function inBox(point: { lat: number | null; lng: number | null }, box: GeoBox): boolean {
  if (point.lat == null || point.lng == null) return false;
  return point.lat >= box.south && point.lat <= box.north && point.lng >= box.west && point.lng <= box.east;
}
