/**
 * Direct KML import script — bypasses HTTP, writes straight to DB via Prisma.
 * Usage: node scripts/import-kml.mjs <path-to-file.kml>
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── KML Parser (mirrors src/lib/kml.ts logic) ───────────────────────────────

function decodeXmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTagContent(raw) {
  const cdataMatch = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdataMatch) return cdataMatch[1].trim();
  return decodeXmlEntities(raw).trim();
}

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

const BRANDS = [
  "EXTRAFLAME", "EVACALOR", "EVA CALOR", "CADEL", "PUNTO FUOCO",
  "LA NORDICA", "NORDICA", "NORDIC", "KING", "JOLLY MEC", "ENVIRO FIRE",
  "ZETA LINEA", "NESTOR MARTIN", "ADLER", "SICALOR", "FINNY", "ZIBRO",
  "IDRO", "MCZ", "PIAZZETTA", "PALAZZETTI", "SUPERIOR", "EDILKAMIN",
  "TREVIFOC", "THERMOROSSI", "CMG", "RAVELLI", "DOVRE", "WAMSLER",
  "RIKA", "INVICTA", "AUSTROFLAMM", "BRUNNER", "BUDERUS", "JOTUL",
  "BIFOCALE", "IRIS", "SIDEROS", "MONTEGRAPPA", "OLIMPIA SPLENDID",
];

function parseDescriptionFields(text) {
  const cleanText = stripHtml(text);
  const lines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean);

  const isPhone = (s) => {
    const core = s.replace(/[\s\-./()+\[\]]/g, "");
    return /^[03+]/.test(s.trim()) && /^\d+$/.test(core) && core.length >= 6;
  };
  const isAddress = (s) =>
    /^(v\.|via\b|strada\b|str\.|fraz(ione)?\b|loc\.|localit[àa]?\b|piazza\b|p\.za\b|corso\b|c\.so\b|viale\b|borgo\b|largo\b|regione\b|vicolo\b)/i.test(s.trim());
  const isProvincia = (s) => /^[A-Z]{2}$/.test(s.trim());
  const isCapLine = (s) => /^\d{5}$/.test(s.trim());
  const dateRe = /^(\d{2})[/\s](\d{2})[/\s](\d{4})/;
  const isBrand = (s) => BRANDS.some((b) => s.toUpperCase().startsWith(b));

  let indirizzo = "", cap = "", citta = "", provincia = "";
  const phones = [];
  let marcaStufa = "";
  const dates = [];

  for (const line of lines) {
    const dateMatch = dateRe.exec(line);
    if (dateMatch) {
      const d = parseInt(dateMatch[1]), mo = parseInt(dateMatch[2]), y = parseInt(dateMatch[3]);
      if (y >= 2000 && y <= 2030 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        dates.push(new Date(y, mo - 1, d));
      }
      continue;
    }
    if (isCapLine(line)) { cap = line; continue; }
    const firstPart = line.split(/\s*[-–]\s*/)[0].replace(/\([^)]*\)/g, "").trim();
    if (isPhone(firstPart)) {
      const parts = line.split(/\s*[-–]\s*/);
      for (const p of parts) {
        const cleaned = p.replace(/\([^)]*\)/g, "").trim();
        if (/^[\d\s.+]{7,}$/.test(cleaned)) phones.push(cleaned);
      }
      continue;
    }
    if (isAddress(line) && !indirizzo) { indirizzo = line; continue; }
    if (isProvincia(line)) { provincia = line; continue; }
    if (!marcaStufa && isBrand(line)) { marcaStufa = line; }
  }

  const provinciaIdx = lines.findIndex((l) => isProvincia(l));
  if (provinciaIdx > 0) {
    for (let j = provinciaIdx - 1; j >= Math.max(0, provinciaIdx - 5); j--) {
      const l = lines[j];
      const fp = l.split(/\s*[-–]\s*/)[0].replace(/\([^)]*\)/g, "").trim();
      if (
        !isPhone(fp) && !isAddress(l) && !isProvincia(l) && !isCapLine(l) && !dateRe.test(l) &&
        /^[A-ZÀÈÌÒÙ'\s\-]+$/.test(l) && l.split(/\s+/).length <= 4 && l.length >= 2
      ) {
        citta = l; break;
      }
    }
  }

  let ultimaVisita = "";
  if (dates.length > 0) {
    const latest = dates.reduce((a, b) => (a > b ? a : b));
    ultimaVisita = latest.toISOString().split("T")[0];
  }

  return { telefono: phones[0] || "", telefono2: phones[1] || "", indirizzo, cap, citta, provincia, marcaStufa, ultimaVisita };
}

function styleToStatoUrgente(styleUrl) {
  const id = styleUrl.toLowerCase();
  if (/^msn_a/.test(id) || /^sn_a/.test(id) || /^sh_a/.test(id))
    return { stato: "ATTIVO", urgente: false };
  if (/^msn_i/.test(id) || /^sn_i/.test(id) || /^sh_i/.test(id))
    return { stato: "INATTIVO", urgente: false };
  if (/^msn_m/.test(id) || /^sn_m/.test(id) || /^sh_m/.test(id))
    return { stato: "ATTIVO", urgente: false };
  if (id.includes("caution") || id.includes("firedept") || id.includes("warning"))
    return { stato: "PROSPECT", urgente: true };
  return { stato: "PROSPECT", urgente: false };
}

function parsePlacemarks(xmlText) {
  const results = [];
  const placemarkRe = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/g;
  let match;

  while ((match = placemarkRe.exec(xmlText)) !== null) {
    const block = match[1];
    const nameMatch = block.match(/<name>([\s\S]*?)<\/name>/);
    const rawName = nameMatch ? extractTagContent(nameMatch[1]) : "";
    if (!rawName || rawName.toLowerCase() === "base") continue;

    const descMatch = block.match(/<description>([\s\S]*?)<\/description>/);
    const rawDesc = descMatch ? extractTagContent(descMatch[1]) : "";

    const styleUrlMatch = block.match(/<styleUrl>#([^<]+)<\/styleUrl>/);
    const styleUrl = styleUrlMatch ? styleUrlMatch[1] : "";
    const { stato, urgente } = styleToStatoUrgente(styleUrl);

    const coordMatch = block.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
    let lat = null, lng = null;
    if (coordMatch) {
      const parts = coordMatch[1].trim().split(",");
      if (parts.length >= 2) {
        const parsedLng = parseFloat(parts[0]), parsedLat = parseFloat(parts[1]);
        if (!isNaN(parsedLng) && !isNaN(parsedLat)) { lng = parsedLng; lat = parsedLat; }
      }
    }

    const nameParts = rawName.split(/[\n\r]+/).map((s) => s.trim()).filter(Boolean);
    let cognome, nome;
    if (nameParts.length >= 2) {
      cognome = nameParts[0]; nome = nameParts[1];
    } else {
      const tokens = rawName.trim().split(/\s+/);
      cognome = tokens[0] ?? rawName; nome = tokens.slice(1).join(" ");
    }

    const fields = rawDesc ? parseDescriptionFields(rawDesc) : { telefono: "", telefono2: "", indirizzo: "", cap: "", citta: "", provincia: "", marcaStufa: "", ultimaVisita: "" };

    results.push({ nome, cognome, email: "", ...fields, modelloStufa: "", note: rawDesc ? stripHtml(rawDesc) : "", stato, urgente, lat, lng });
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/import-kml.mjs <path-to-file.kml>");
  process.exit(1);
}

console.log(`Reading ${filePath}...`);
const xmlText = readFileSync(filePath, "utf-8");

console.log("Parsing placemarks...");
const parsed = parsePlacemarks(xmlText);
console.log(`Found ${parsed.length} placemarks`);

if (parsed.length === 0) {
  console.log("Nothing to import."); process.exit(0);
}

console.log("Loading existing clients from DB...");
const existingClients = await prisma.client.findMany({
  select: { id: true, nome: true, lat: true, lng: true, cognome: true, telefono: true, telefono2: true, indirizzo: true, cap: true, citta: true, provincia: true, marcaStufa: true, modelloStufa: true, note: true, ultimaVisita: true },
});
console.log(`Found ${existingClients.length} existing clients`);

const lookup = new Map();
for (const c of existingClients) {
  if (c.lat !== null && c.lng !== null) {
    const key = `${c.nome}|${Math.round(c.lat * 10000)}|${Math.round(c.lng * 10000)}`;
    lookup.set(key, c);
  }
}

const toCreate = [], toUpdate = [];
for (const item of parsed) {
  if (item.lat === null || item.lng === null) { toCreate.push(item); continue; }
  const key = `${item.nome}|${Math.round(item.lat * 10000)}|${Math.round(item.lng * 10000)}`;
  const existing = lookup.get(key);
  if (existing) toUpdate.push({ id: existing.id, existing, item });
  else toCreate.push(item);
}
console.log(`To create: ${toCreate.length}, to update: ${toUpdate.length}`);

// Batch create
let created = 0, updated = 0, skipped = 0;
if (toCreate.length > 0) {
  console.log("Batch inserting new clients...");
  const result = await prisma.client.createMany({
    data: toCreate.map((item) => ({
      nome: item.nome, cognome: item.cognome ?? "",
      email: null,
      telefono: item.telefono || null, telefono2: item.telefono2 || null,
      indirizzo: item.indirizzo || null, cap: item.cap || null,
      citta: item.citta || null, provincia: item.provincia || null,
      marcaStufa: item.marcaStufa || null, modelloStufa: null,
      note: item.note || null, stato: item.stato || "PROSPECT",
      urgente: item.urgente ?? false,
      ultimaVisita: item.ultimaVisita ? new Date(item.ultimaVisita) : null,
      lat: item.lat, lng: item.lng,
    })),
    skipDuplicates: true,
  });
  created = result.count;
  console.log(`Created: ${created}`);
}

// Parallel updates in batches of 30
console.log("Updating existing clients...");
const BATCH = 30;
for (let i = 0; i < toUpdate.length; i += BATCH) {
  const batch = toUpdate.slice(i, i + BATCH);
  await Promise.allSettled(
    batch.map(async ({ id, existing, item }) => {
      try {
        await prisma.client.update({
          where: { id },
          data: {
            cognome: item.cognome || existing.cognome,
            telefono: item.telefono || existing.telefono,
            telefono2: item.telefono2 || existing.telefono2,
            indirizzo: item.indirizzo || existing.indirizzo,
            cap: item.cap || existing.cap,
            citta: item.citta || existing.citta,
            provincia: item.provincia || existing.provincia,
            marcaStufa: item.marcaStufa || existing.marcaStufa,
            modelloStufa: item.modelloStufa || existing.modelloStufa,
            note: item.note || existing.note,
            stato: item.stato || "PROSPECT",
            urgente: item.urgente ?? false,
            ultimaVisita: item.ultimaVisita ? new Date(item.ultimaVisita) : existing.ultimaVisita,
            lat: item.lat ?? existing.lat, lng: item.lng ?? existing.lng,
          },
        });
        updated++;
      } catch {
        skipped++;
      }
    })
  );
  process.stdout.write(`\r  Updated ${Math.min(i + BATCH, toUpdate.length)}/${toUpdate.length}...`);
}
console.log(`\nUpdated: ${updated}, Skipped: ${skipped}`);
console.log(`\n✓ Import complete — created: ${created}, updated: ${updated}, skipped: ${skipped}`);

await prisma.$disconnect();
