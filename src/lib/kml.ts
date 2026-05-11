import { kml } from "@tmcw/togeojson";
import JSZip from "jszip";
import type { ClientFormData } from "@/types/client";

export interface ParsedKmlClient
  extends Omit<ClientFormData, "ultimaVisita"> {
  lat: number | null;
  lng: number | null;
  ultimaVisita: string;
}

function extractTextContent(description: string): string {
  // Strip HTML tags from KML description
  return description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseKmlDocument(xmlText: string): ParsedKmlClient[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const geoJson = kml(xmlDoc);

  const results: ParsedKmlClient[] = [];

  for (const feature of geoJson.features) {
    if (!feature || feature.geometry?.type !== "Point") continue;

    const coords = feature.geometry.coordinates as number[];
    const props = feature.properties ?? {};

    const name: string = props.name ?? "";
    const parts = name.trim().split(/\s+/);
    const nome = parts[0] ?? name;
    const cognome = parts.slice(1).join(" ");

    const description = props.description
      ? extractTextContent(String(props.description))
      : "";

    results.push({
      nome,
      cognome,
      email: "",
      telefono: "",
      indirizzo: "",
      note: description,
      stato: "PROSPECT",
      ultimaVisita: "",
      lat: typeof coords[1] === "number" ? coords[1] : null,
      lng: typeof coords[0] === "number" ? coords[0] : null,
    });
  }

  return results;
}

export async function parseKmlBuffer(
  buffer: ArrayBuffer,
  filename: string
): Promise<ParsedKmlClient[]> {
  const lowerName = filename.toLowerCase();

  if (lowerName.endsWith(".kmz")) {
    const zip = await JSZip.loadAsync(buffer);
    // Find the first .kml file inside
    const kmlFile = Object.values(zip.files).find((f) =>
      f.name.toLowerCase().endsWith(".kml")
    );
    if (!kmlFile) throw new Error("Nessun file .kml trovato dentro il .kmz");
    const kmlText = await kmlFile.async("string");
    return parseKmlDocument(kmlText);
  }

  if (lowerName.endsWith(".kml")) {
    const text = new TextDecoder().decode(buffer);
    return parseKmlDocument(text);
  }

  throw new Error("Formato non supportato. Carica un file .kml o .kmz");
}
