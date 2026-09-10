export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
}

export type GeoStatus = "ok" | "missing" | "not_found" | "ambiguous";

export function buildClientAddress(client: {
  indirizzo: string | null;
  civico?: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
}): string {
  const street = [client.indirizzo, client.civico].filter(Boolean).join(" ");
  return [street, client.cap, client.citta, client.provincia]
    .filter(Boolean)
    .join(", ")
    .trim();
}

const NOMINATIM_DELAY_MS = 1100;

export function nominatimDelayMs() {
  return NOMINATIM_DELAY_MS;
}

export async function geocodeCandidates(
  address: string,
  limit = 5
): Promise<GeocodingResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 8)));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "it");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "TropiniPlatform/1.0",
    },
  });

  if (!response.ok) return [];

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) return [];

  return data.map((result: { lat: string; lon: string; display_name: string }) => ({
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    displayName: result.display_name,
  }));
}

export async function geocodeAddress(
  address: string
): Promise<GeocodingResult | null> {
  const candidates = await geocodeCandidates(address, 1);
  return candidates[0] ?? null;
}

export function geoStatusFromCandidates(
  address: string,
  candidates: GeocodingResult[]
): GeoStatus {
  if (!address.trim()) return "missing";
  if (candidates.length === 0) return "not_found";
  if (candidates.length > 1) return "ambiguous";
  return "ok";
}
