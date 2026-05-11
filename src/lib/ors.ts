export interface ORSWaypoint {
  name: string;
  location: [number, number]; // [lng, lat]
}

export interface ORSJob {
  id: number;
  location: [number, number]; // [lng, lat]
  description?: string;
}

export interface ORSOptimizationResult {
  routes: Array<{
    steps: Array<{
      type: string;
      job?: number;
      arrival: number;
      duration: number;
    }>;
    duration: number;
    distance: number;
  }>;
  geometry?: string;
}

export interface ORSDirectionsResult {
  features: Array<{
    geometry: {
      coordinates: [number, number][];
      type: string;
    };
    properties: {
      segments: Array<{
        distance: number;
        duration: number;
      }>;
      summary: {
        distance: number;
        duration: number;
      };
    };
  }>;
}

const ORS_BASE = "https://api.openrouteservice.org";

export async function optimizeRoute(
  startLng: number,
  startLat: number,
  jobs: ORSJob[]
): Promise<ORSOptimizationResult> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) throw new Error("ORS_API_KEY non configurata");

  const body = {
    jobs: jobs.map((j) => ({
      id: j.id,
      location: j.location,
      description: j.description ?? "",
    })),
    vehicles: [
      {
        id: 1,
        profile: "driving-car",
        start: [startLng, startLat],
        end: [startLng, startLat],
      },
    ],
  };

  const response = await fetch(`${ORS_BASE}/optimization`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ORS optimization error: ${response.status} - ${text}`);
  }

  return response.json();
}

export async function getRouteGeometry(
  coordinates: [number, number][] // array di [lng, lat]
): Promise<ORSDirectionsResult> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) throw new Error("ORS_API_KEY non configurata");

  const response = await fetch(
    `${ORS_BASE}/v2/directions/driving-car/geojson`,
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coordinates }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ORS directions error: ${response.status} - ${text}`);
  }

  return response.json();
}
