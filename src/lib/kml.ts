import JSZip from "jszip";

export interface ParsedKmlClient {
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  telefono2: string;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
  marcaStufa: string;
  modelloStufa: string;
  note: string;
  stato: string;
  ultimaVisita: string;
  lat: number | null;
  lng: number | null;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTagContent(raw: string): string {
  // Handle CDATA
  const cdataMatch = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdataMatch) return cdataMatch[1].trim();
  return decodeXmlEntities(raw).trim();
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

const BRANDS = [
  "EXTRAFLAME", "EVACALOR", "EVA CALOR", "CADEL", "PUNTO FUOCO",
  "LA NORDICA", "NORDICA", "NORDIC", "KING", "JOLLY MEC", "ENVIRO FIRE",
  "ZETA LINEA", "NESTOR MARTIN", "ADLER", "SICALOR", "FINNY", "ZIBRO",
  "IDRO", "MCZ", "PIAZZETTA", "PALAZZETTI", "SUPERIOR", "EDILKAMIN",
  "TREVIFOC", "THERMOROSSI", "CMG", "RAVELLI", "DOVRE", "WAMSLER",
  "RIKA", "INVICTA", "AUSTROFLAMM", "BRUNNER", "BUDERUS", "JOTUL",
  "BIFOCALE", "IRIS",
];

function parseDescriptionFields(text: string): {
  telefono: string;
  telefono2: string;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
  marcaStufa: string;
  ultimaVisita: string;
} {
  const cleanText = stripHtml(text);
  const lines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean);

  const isPhone = (s: string): boolean => {
    const core = s.replace(/[\s\-./()+\[\]]/g, "");
    return /^[03+]/.test(s.trim()) && /^\d+$/.test(core) && core.length >= 6;
  };

  const isAddress = (s: string): boolean =>
    /^(v\.|via\b|strada\b|str\.|fraz(ione)?\b|loc\.|localit[àa]?\b|piazza\b|p\.za\b|corso\b|c\.so\b|viale\b|borgo\b|largo\b|regione\b|vicolo\b)/i.test(
      s.trim()
    );

  const isProvincia = (s: string): boolean => /^[A-Z]{2}$/.test(s.trim());

  const isCapLine = (s: string): boolean => /^\d{5}$/.test(s.trim());

  // Date: DD MM YYYY or DD/MM/YYYY at start of line
  const dateRe = /^(\d{2})[/\s](\d{2})[/\s](\d{4})/;

  const isBrand = (s: string): boolean =>
    BRANDS.some((b) => s.toUpperCase().startsWith(b));

  let indirizzo = "";
  let cap = "";
  let citta = "";
  let provincia = "";
  const phones: string[] = [];
  let marcaStufa = "";
  const dates: Date[] = [];

  for (const line of lines) {
    // Date line
    const dateMatch = dateRe.exec(line);
    if (dateMatch) {
      const d = parseInt(dateMatch[1]);
      const mo = parseInt(dateMatch[2]);
      const y = parseInt(dateMatch[3]);
      if (y >= 2000 && y <= 2030 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        dates.push(new Date(y, mo - 1, d));
      }
      continue;
    }

    // CAP
    if (isCapLine(line)) {
      cap = line;
      continue;
    }

    // Phone(s) — possibly two on one line: "347 xxx - 348 xxx"
    const firstPart = line.split(/\s*[-–]\s*/)[0].replace(/\([^)]*\)/g, "").trim();
    if (isPhone(firstPart)) {
      const parts = line.split(/\s*[-–]\s*/);
      for (const p of parts) {
        const cleaned = p.replace(/\([^)]*\)/g, "").trim();
        if (/^[\d\s.+]{7,}$/.test(cleaned)) phones.push(cleaned);
      }
      continue;
    }

    // Address
    if (isAddress(line) && !indirizzo) {
      indirizzo = line;
      continue;
    }

    // Province (2-letter abbreviation)
    if (isProvincia(line)) {
      provincia = line;
      continue;
    }

    // Brand
    if (!marcaStufa && isBrand(line)) {
      marcaStufa = line;
    }
  }

  // City: scan backwards from the province line
  const provinciaIdx = lines.findIndex((l) => isProvincia(l));
  if (provinciaIdx > 0) {
    for (let j = provinciaIdx - 1; j >= Math.max(0, provinciaIdx - 5); j--) {
      const l = lines[j];
      const fp = l.split(/\s*[-–]\s*/)[0].replace(/\([^)]*\)/g, "").trim();
      if (
        !isPhone(fp) &&
        !isAddress(l) &&
        !isProvincia(l) &&
        !isCapLine(l) &&
        !dateRe.test(l) &&
        /^[A-ZÀÈÌÒÙ'\s\-]+$/.test(l) &&
        l.split(/\s+/).length <= 4 &&
        l.length >= 2
      ) {
        citta = l;
        break;
      }
    }
  }

  // Latest date → ultimaVisita
  let ultimaVisita = "";
  if (dates.length > 0) {
    const latest = dates.reduce((a, b) => (a > b ? a : b));
    ultimaVisita = latest.toISOString().split("T")[0];
  }

  return {
    telefono: phones[0] || "",
    telefono2: phones[1] || "",
    indirizzo,
    cap,
    citta,
    provincia,
    marcaStufa,
    ultimaVisita,
  };
}

function parsePlacemarks(xmlText: string): ParsedKmlClient[] {
  const results: ParsedKmlClient[] = [];
  const placemarkRe = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/g;
  let match;

  while ((match = placemarkRe.exec(xmlText)) !== null) {
    const block = match[1];

    const nameMatch = block.match(/<name>([\s\S]*?)<\/name>/);
    const rawName = nameMatch ? extractTagContent(nameMatch[1]) : "";
    if (!rawName || rawName.toLowerCase() === "base") continue;

    const descMatch = block.match(/<description>([\s\S]*?)<\/description>/);
    const rawDesc = descMatch ? extractTagContent(descMatch[1]) : "";

    const coordMatch = block.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
    let lat: number | null = null;
    let lng: number | null = null;
    if (coordMatch) {
      const parts = coordMatch[1].trim().split(",");
      if (parts.length >= 2) {
        const parsedLng = parseFloat(parts[0]);
        const parsedLat = parseFloat(parts[1]);
        if (!isNaN(parsedLng) && !isNaN(parsedLat)) {
          lng = parsedLng;
          lat = parsedLat;
        }
      }
    }

    // Parse name: multiline → first=cognome, second=nome
    const nameParts = rawName.split(/[\n\r]+/).map((s) => s.trim()).filter(Boolean);
    let cognome: string, nome: string;
    if (nameParts.length >= 2) {
      cognome = nameParts[0];
      nome = nameParts[1];
    } else {
      const tokens = rawName.trim().split(/\s+/);
      cognome = tokens[0] ?? rawName;
      nome = tokens.slice(1).join(" ");
    }

    const fields = rawDesc
      ? parseDescriptionFields(rawDesc)
      : {
          telefono: "",
          telefono2: "",
          indirizzo: "",
          cap: "",
          citta: "",
          provincia: "",
          marcaStufa: "",
          ultimaVisita: "",
        };

    results.push({
      nome,
      cognome,
      email: "",
      ...fields,
      modelloStufa: "",
      note: rawDesc ? stripHtml(rawDesc) : "",
      stato: "PROSPECT",
      lat,
      lng,
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
    const kmlFile = Object.values(zip.files).find((f) =>
      f.name.toLowerCase().endsWith(".kml")
    );
    if (!kmlFile) throw new Error("Nessun file .kml trovato dentro il .kmz");
    const kmlText = await kmlFile.async("string");
    return parsePlacemarks(kmlText);
  }

  if (lowerName.endsWith(".kml")) {
    const text = new TextDecoder().decode(buffer);
    return parsePlacemarks(text);
  }

  throw new Error("Formato non supportato. Carica un file .kml o .kmz");
}

