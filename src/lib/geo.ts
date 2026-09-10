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

export function inBox(point: { lat: number | null; lng: number | null }, box: GeoBox): boolean {
  if (point.lat == null || point.lng == null) return false;
  return point.lat >= box.south && point.lat <= box.north && point.lng >= box.west && point.lng <= box.east;
}
