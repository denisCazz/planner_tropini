/**
 * Importa anagrafica EssentialPIM (.epim) + placemark Google Earth (KML/KMZ)
 * nella sola organizzazione Tropini Service.
 *
 * Usage:
 *   node scripts/import-tropini-data.mjs
 *   node scripts/import-tropini-data.mjs --epim-export /tmp/epim-import/contacts.txt
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import JSZip from "jszip";
import { scryptSync, randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const prisma = new PrismaClient();

const TROPINI_ORG_ID = "org_tropini";
const TROPINI_ORG_SLUG = "tropini-service";
const TROPINI_ORG_NAME = "Tropini Service";

const FIELD_MAP = {
  1: "nome",
  2: "cognome",
  3: "telefono",
  4: "telefono2",
  5: "email",
  6: "pellet",
  7: "citta",
  8: "provincia",
  9: "cap",
  15: "accensione",
  76725613: "indirizzo",
  1296361025: "marca",
  1614235494: "marca",
  1937219446: "modello",
  2068518109: "matricola",
  1122251329: "provincia",
  1130876818: "cap",
  1156306990: "citta",
  1943539937: "citta",
  594988391: "localita",
  2097270199: "email",
  1851871267: "note",
  1491271396: "indicazioni",
  1185417036: "richiesta",
  1816142867: "clienteDi",
  24324493: "anno",
  163118689: "libretto",
  1372787560: "garanzia",
  1770590224: "programmato",
  1244320323: "accensione2",
  944941645: "dataChiamata",
  21300272: "manutenzione",
  89622808: "manutenzione",
  870675784: "manutenzione",
  1470958520: "manutenzione",
  1075128585: "manutenzione",
  1163951458: "manutenzione",
  1308712706: "manutenzione",
  2015223934: "manutenzione",
  258436264: "manutenzione",
  1766388567: "manutenzione",
  748291148: "manutenzione",
};

const BRANDS = [
  "EXTRAFLAME", "EVACALOR", "EVA CALOR", "CADEL", "PUNTO FUOCO",
  "LA NORDICA", "NORDICA", "NORDIC", "KING", "JOLLY MEC", "ENVIRO FIRE",
  "ZETA LINEA", "NESTOR MARTIN", "ADLER", "SICALOR", "FINNY", "ZIBRO",
  "IDRO", "MCZ", "PIAZZETTA", "PALAZZETTI", "SUPERIOR", "EDILKAMIN",
  "TREVIFOC", "THERMOROSSI", "CMG", "RAVELLI", "DOVRE", "WAMSLER",
  "RIKA", "INVICTA", "AUSTROFLAMM", "BRUNNER", "BUDERUS", "JOTUL",
  "BIFOCALE", "IRIS", "SIDEROS", "MONTEGRAPPA", "OLIMPIA SPLENDID", "ELLEDI",
];

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function norm(s) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameKey(cognome, nome) {
  return `${norm(cognome)}|${norm(nome)}`;
}

function phoneDigits(s) {
  const d = (s ?? "").replace(/\D/g, "");
  return d.length >= 6 ? d.slice(-9) : "";
}

function parseFieldsData(s) {
  if (!s || s === "<null>") return {};
  const raw = Buffer.from(s, "utf8");
  const out = {};
  let i = 0;
  while (i + 12 <= raw.length) {
    const idHex = raw.subarray(i, i + 8).toString("ascii");
    const lenHex = raw.subarray(i + 8, i + 12).toString("ascii");
    if (!/^[0-9A-Fa-f]{8}$/.test(idHex) || !/^[0-9A-Fa-f]{4}$/.test(lenHex)) break;
    const fid = parseInt(idHex, 16);
    const ln = parseInt(lenHex, 16);
    i += 12;
    const val = raw.subarray(i, i + ln).toString("utf8").trim();
    i += ln;
    if (val) out[fid] = out[fid] ? `${out[fid]}\n${val}` : val;
  }
  return out;
}

function parseItDate(s) {
  const t = (s ?? "").trim();
  const m = t.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})/);
  if (m) {
    const d = +m[1], mo = +m[2], y = +m[3];
    if (y >= 1990 && y <= 2035 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return new Date(Date.UTC(y, mo - 1, d));
    }
  }
  return null;
}

function parseYear(s) {
  const m = (s ?? "").match(/\b(19\d{2}|20\d{2})\b/);
  if (!m) return null;
  const y = +m[1];
  return y >= 1970 && y <= 2035 ? y : null;
}

function stripHtml(s) {
  return (s ?? "").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function splitPhones(s) {
  const phones = [];
  for (const part of (s ?? "").split(/\s*[-–]\s*/)) {
    const cleaned = part.replace(/\([^)]*\)/g, "").trim();
    if (/^[\d\s.+]{6,}$/.test(cleaned) && cleaned.replace(/\D/g, "").length >= 6) {
      phones.push(cleaned.replace(/\s+/g, " ").trim());
    }
  }
  return phones;
}

function looksLikeNote(s) {
  const t = (s ?? "").trim();
  if (t.length > 24) return true;
  return /non chiam|avvisa|richiam|segreter|occupat|n[oò]/i.test(t);
}

function pick(map, key) {
  const v = map[key];
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

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

  let indirizzo = "", cap = "", citta = "", provincia = "", marcaStufa = "";
  const phones = [];
  const dates = [];

  for (const line of lines) {
    const dateMatch = dateRe.exec(line);
    if (dateMatch) {
      const d = parseInt(dateMatch[1]), mo = parseInt(dateMatch[2]), y = parseInt(dateMatch[3]);
      if (y >= 2000 && y <= 2035 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        dates.push(new Date(Date.UTC(y, mo - 1, d)));
      }
      continue;
    }
    if (isCapLine(line)) { cap = line; continue; }
    const firstPart = line.split(/\s*[-–]\s*/)[0].replace(/\([^)]*\)/g, "").trim();
    if (isPhone(firstPart)) {
      phones.push(...splitPhones(line));
      continue;
    }
    if (isAddress(line) && !indirizzo) { indirizzo = line; continue; }
    if (isProvincia(line)) { provincia = line; continue; }
    if (!marcaStufa && isBrand(line)) marcaStufa = line;
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
        citta = l;
        break;
      }
    }
  }

  let ultimaVisita = "";
  if (dates.length > 0) {
    const latest = dates.reduce((a, b) => (a > b ? a : b));
    ultimaVisita = latest.toISOString().slice(0, 10);
  }

  return { telefono: phones[0] || "", telefono2: phones[1] || "", indirizzo, cap, citta, provincia, marcaStufa, ultimaVisita };
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
        if (!Number.isNaN(parsedLng) && !Number.isNaN(parsedLat)) {
          lng = parsedLng;
          lat = parsedLat;
        }
      }
    }
    const nameParts = rawName.split(/[\n\r]+/).map((s) => s.trim()).filter(Boolean);
    let cognome, nome;
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
      : { telefono: "", telefono2: "", indirizzo: "", cap: "", citta: "", provincia: "", marcaStufa: "", ultimaVisita: "" };
    results.push({
      nome, cognome, ...fields,
      modelloStufa: "",
      note: rawDesc ? stripHtml(rawDesc) : "",
      stato, urgente, lat, lng,
    });
  }
  return results;
}

async function parseKmlOrKmz(filePath) {
  const buf = readFileSync(filePath);
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".kmz")) {
    const zip = await JSZip.loadAsync(buf);
    const kmlFile = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith(".kml"));
    if (!kmlFile) return [];
    return parsePlacemarks(await kmlFile.async("string"));
  }
  return parsePlacemarks(buf.toString("utf8"));
}

function parseIsqlList(text) {
  const records = [];
  for (const block of text.split(/\n\s*\n/)) {
    if (!block.includes("IDCONTACT")) continue;
    const rec = {};
    for (const line of block.split("\n")) {
      const m = line.match(/^(IDCONTACT|SUBJECT|CREATED|LASTCHANGED|FIELDSDATA)\s+(.*)$/);
      if (m) rec[m[1]] = m[2].trim();
    }
    if (rec.IDCONTACT && rec.IDCONTACT !== "<null>") records.push(rec);
  }
  return records;
}

function epimToClient(rec) {
  const fields = parseFieldsData(rec.FIELDSDATA);
  const mapped = {};
  const extraNotes = [];
  for (const [fid, val] of Object.entries(fields)) {
    const key = FIELD_MAP[Number(fid)];
    if (!key) {
      if (looksLikeNote(val)) extraNotes.push(stripHtml(val));
      continue;
    }
    if (key === "manutenzione") {
      if (looksLikeNote(val)) extraNotes.push(stripHtml(val));
      else mapped.manutenzione = mapped.manutenzione ? `${mapped.manutenzione}\n${val}` : val;
      continue;
    }
    if (["note", "indicazioni", "richiesta", "clienteDi", "libretto", "garanzia", "programmato", "accensione", "accensione2", "dataChiamata", "pellet", "localita"].includes(key)) {
      mapped[key] = mapped[key] ? `${mapped[key]}\n${val}` : val;
      continue;
    }
    if (!mapped[key]) mapped[key] = val;
  }

  let nome = pick(mapped, "nome");
  let cognome = pick(mapped, "cognome");
  if (!nome && !cognome && rec.SUBJECT && rec.SUBJECT !== "<null>") {
    const tokens = rec.SUBJECT.replace(/\s+/g, " ").trim().split(" ");
    if (tokens.length === 1) cognome = tokens[0];
    else if (tokens.length === 2) {
      nome = tokens[0];
      cognome = tokens[1];
    } else {
      nome = tokens[0];
      cognome = tokens.slice(1).join(" ");
    }
  }

  const phones = [...splitPhones(mapped.telefono), ...splitPhones(mapped.telefono2)];
  const noteParts = [
    mapped.note, mapped.indicazioni, mapped.richiesta, mapped.clienteDi,
    mapped.localita && `Località: ${mapped.localita}`,
    mapped.pellet && `Combustibile: ${mapped.pellet}`,
    mapped.accensione && `Accensione: ${mapped.accensione}`,
    mapped.accensione2 && `Accensione 2: ${mapped.accensione2}`,
    mapped.libretto && `Libretto: ${mapped.libretto}`,
    mapped.garanzia && `Garanzia: ${mapped.garanzia}`,
    mapped.programmato && `Programmato: ${mapped.programmato}`,
    mapped.dataChiamata && `Data chiamata: ${mapped.dataChiamata}`,
    ...extraNotes,
  ].filter(Boolean).map(stripHtml);

  const dates = [];
  for (const part of (mapped.manutenzione ?? "").split("\n")) {
    const d = parseItDate(part);
    if (d) dates.push(d);
  }
  const ultimaVisita = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
  const anno = parseYear(mapped.anno);
  const hasPlant = Boolean(mapped.marca || mapped.modello || mapped.matricola);
  const stato = ultimaVisita || hasPlant ? "ATTIVO" : "PROSPECT";

  return {
    externalId: `epim:${rec.IDCONTACT}`,
    codiceCliente: rec.IDCONTACT,
    nome: nome || "",
    cognome: cognome || (rec.SUBJECT && rec.SUBJECT !== "<null>" ? rec.SUBJECT : "Senza nome"),
    email: pick(mapped, "email") || null,
    telefono: phones[0] || null,
    telefono2: phones[1] || null,
    indirizzo: pick(mapped, "indirizzo") || null,
    cap: pick(mapped, "cap") || null,
    citta: pick(mapped, "citta") || null,
    provincia: pick(mapped, "provincia") || null,
    marcaStufa: pick(mapped, "marca") || null,
    modelloStufa: pick(mapped, "modello") || null,
    note: noteParts.join("\n") || null,
    stato,
    urgente: /richiam|urgente|non chiam/i.test(noteParts.join(" ")),
    ultimaVisita,
    matricola: pick(mapped, "matricola") || null,
    annoInstallazione: anno,
    createdAt: rec.CREATED && rec.CREATED !== "<null>" ? new Date(rec.CREATED) : undefined,
  };
}

function mergeInto(target, extra) {
  const fill = (k, v) => {
    if (v && !target[k]) target[k] = v;
  };
  fill("nome", extra.nome);
  fill("cognome", extra.cognome);
  fill("telefono", extra.telefono);
  fill("telefono2", extra.telefono2);
  fill("indirizzo", extra.indirizzo);
  fill("cap", extra.cap);
  fill("citta", extra.citta);
  fill("provincia", extra.provincia);
  fill("marcaStufa", extra.marcaStufa);
  fill("modelloStufa", extra.modelloStufa);
  if (extra.lat != null) target.lat = extra.lat;
  if (extra.lng != null) target.lng = extra.lng;
  if (extra.stato === "ATTIVO" || extra.stato === "INATTIVO") target.stato = extra.stato;
  if (extra.urgente) target.urgente = true;
  if (extra.ultimaVisita) {
    const d = extra.ultimaVisita instanceof Date ? extra.ultimaVisita : new Date(extra.ultimaVisita);
    if (!target.ultimaVisita || d > target.ultimaVisita) target.ultimaVisita = d;
  }
  if (extra.note) {
    target.note = target.note ? `${target.note}\n${extra.note}` : extra.note;
  }
}

function findEpimExportPath() {
  const argIdx = process.argv.indexOf("--epim-export");
  if (argIdx >= 0 && process.argv[argIdx + 1]) return process.argv[argIdx + 1];
  const candidates = [
    "/tmp/epim-import/contacts.txt",
    join(ROOT, "scripts/.cache/epim-contacts.txt"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

function exportEpimViaDocker(epimPath) {
  const outDir = "/tmp/epim-import";
  execFileSync("mkdir", ["-p", outDir]);
  execFileSync("cp", [epimPath, join(outDir, "epim.fdb")]);
  execFileSync("chmod", ["666", join(outDir, "epim.fdb")]);
  try { execFileSync("docker", ["rm", "-f", "fb-epim"], { stdio: "ignore" }); } catch { /* ok */ }
  execFileSync("docker", [
    "run", "-d", "--name", "fb-epim",
    "-e", "ISC_PASSWORD=masterkey",
    "-v", `${outDir}:/firebird/data`,
    "jacobalberty/firebird:2.5-sc",
  ], { stdio: "inherit" });
  execFileSync("sleep", ["3"]);
  writeSqlExport(outDir);
  execFileSync("docker", [
    "exec", "fb-epim",
    "/usr/local/firebird/bin/isql",
    "-user", "SYSDBA", "-password", "masterkey",
    "/firebird/data/epim.fdb",
    "-i", "/firebird/data/export.sql",
  ]);
  return join(outDir, "contacts.txt");
}

function writeSqlExport(outDir) {
  writeFileSync(
    join(outDir, "export.sql"),
    `OUTPUT /firebird/data/contacts.txt;
SET LIST ON;
SELECT IDCONTACT, SUBJECT, CREATED, LASTCHANGED, FIELDSDATA FROM CONTACTS WHERE DELETED IS NULL;
`
  );
}

async function ensureOrg() {
  const tropini = await prisma.organization.upsert({
    where: { slug: TROPINI_ORG_SLUG },
    update: { name: TROPINI_ORG_NAME, isDemo: false },
    create: {
      id: TROPINI_ORG_ID,
      name: TROPINI_ORG_NAME,
      slug: TROPINI_ORG_SLUG,
      isDemo: false,
    },
  });
  await prisma.settings.upsert({
    where: { organizationId: tropini.id },
    update: {
      startLat: 44.7089,
      startLng: 7.6617,
      startLabel: "Via San Giorgio 14, Cavallermaggiore",
    },
    create: {
      id: "set_tropini",
      organizationId: tropini.id,
      startLat: 44.7089,
      startLng: 7.6617,
      startLabel: "Via San Giorgio 14, Cavallermaggiore",
    },
  });
  const adminUser = process.env.AUTH_USERNAME ?? "admin";
  const adminPass = process.env.AUTH_PASSWORD ?? "admin123";
  await prisma.user.upsert({
    where: { username: adminUser },
    update: {
      role: "ADMIN",
      organizationId: tropini.id,
      attivo: true,
      passwordHash: hashPassword(adminPass),
    },
    create: {
      username: adminUser,
      passwordHash: hashPassword(adminPass),
      role: "ADMIN",
      organizationId: tropini.id,
      attivo: true,
    },
  });
  const removed = await prisma.organization.deleteMany({
    where: { slug: { not: TROPINI_ORG_SLUG } },
  });
  if (removed.count) console.log(`Rimosse ${removed.count} società extra`);
  return tropini;
}

async function main() {
  const tropini = await ensureOrg();
  let exportPath = findEpimExportPath();
  if (!exportPath) {
    const epimFile = join(ROOT, "02 06 2026epim.epim");
    if (!existsSync(epimFile)) throw new Error("File EPIM non trovato e nessun export --epim-export");
    console.log("Esporto EPIM via Firebird Docker…");
    exportPath = exportEpimViaDocker(epimFile);
  }
  console.log(`Leggo EPIM da ${exportPath}`);
  const epimRows = parseIsqlList(readFileSync(exportPath, "utf8")).map(epimToClient);
  console.log(`Contatti EPIM: ${epimRows.length}`);

  const kmlFiles = [
    join(ROOT, "public/location/test/doc.kml"),
    join(ROOT, "public/location/doc.kml"),
    join(ROOT, "public/location/marzo/doc.kml"),
    join(ROOT, "31 05 2026 bis.kmz"),
  ].filter(existsSync);

  const kmlClients = [];
  for (const f of kmlFiles) {
    const parsed = await parseKmlOrKmz(f);
    console.log(`KML ${f.replace(ROOT + "/", "")}: ${parsed.length} placemark`);
    kmlClients.push(...parsed);
  }

  const byName = new Map();
  const byNameRev = new Map();
  const byPhone = new Map();
  for (const c of epimRows) {
    const k = nameKey(c.cognome, c.nome);
    const kr = nameKey(c.nome, c.cognome);
    if (k !== "|") byName.set(k, c);
    if (kr !== "|" && kr !== k) byNameRev.set(kr, c);
    const p = phoneDigits(c.telefono);
    if (p) byPhone.set(p, c);
  }

  let matched = 0;
  let kmlOnly = 0;
  for (const k of kmlClients) {
    const k1 = nameKey(k.cognome, k.nome);
    const k2 = nameKey(k.nome, k.cognome);
    const p = phoneDigits(k.telefono);
    const target = byName.get(k1) || byName.get(k2) || byNameRev.get(k1) || (p ? byPhone.get(p) : null);
    if (target) {
      mergeInto(target, k);
      matched++;
    } else {
      kmlOnly++;
      epimRows.push({
        externalId: `kml:${norm(k.cognome)}:${norm(k.nome)}:${k.lat ?? ""}:${k.lng ?? ""}`,
        codiceCliente: null,
        nome: k.nome || "",
        cognome: k.cognome || "Senza nome",
        email: null,
        telefono: k.telefono || null,
        telefono2: k.telefono2 || null,
        indirizzo: k.indirizzo || null,
        cap: k.cap || null,
        citta: k.citta || null,
        provincia: k.provincia || null,
        marcaStufa: k.marcaStufa || null,
        modelloStufa: k.modelloStufa || null,
        note: k.note || null,
        stato: k.stato || "PROSPECT",
        urgente: k.urgente ?? false,
        ultimaVisita: k.ultimaVisita ? new Date(k.ultimaVisita) : null,
        lat: k.lat,
        lng: k.lng,
        matricola: null,
        annoInstallazione: null,
      });
    }
  }
  console.log(`KML abbinati a EPIM: ${matched}, solo mappa: ${kmlOnly}`);

  const existing = await prisma.client.findMany({
    where: { organizationId: tropini.id },
    select: { id: true, externalId: true },
  });
  const existingByExt = new Map(existing.map((c) => [c.externalId, c.id]));

  const toCreate = [];
  const toUpdate = [];
  for (const c of epimRows) {
    if (!c.nome && !c.cognome && !c.telefono && !c.indirizzo) continue;
    const row = {
      organizationId: tropini.id,
      externalId: c.externalId,
      codiceCliente: c.codiceCliente,
      nome: c.nome || "",
      cognome: c.cognome || "",
      email: c.email,
      telefono: c.telefono,
      telefono2: c.telefono2,
      indirizzo: c.indirizzo,
      cap: c.cap,
      citta: c.citta,
      provincia: c.provincia,
      marcaStufa: c.marcaStufa,
      modelloStufa: c.modelloStufa,
      note: c.note,
      stato: c.stato || "PROSPECT",
      urgente: Boolean(c.urgente),
      ultimaVisita: c.ultimaVisita ?? null,
      lat: c.lat ?? null,
      lng: c.lng ?? null,
      geoStatus: c.lat != null && c.lng != null ? "ok" : null,
      ...(c.createdAt ? { createdAt: c.createdAt } : {}),
    };
    const id = existingByExt.get(c.externalId);
    if (id) toUpdate.push({ id, data: row });
    else toCreate.push({ ...row, _plant: { marca: c.marcaStufa, modello: c.modelloStufa, matricola: c.matricola, anno: c.annoInstallazione, ultima: c.ultimaVisita } });
  }

  console.log(`Da creare: ${toCreate.length}, da aggiornare: ${toUpdate.length}`);

  const BATCH = 200;
  let created = 0;
  for (let i = 0; i < toCreate.length; i += BATCH) {
    const slice = toCreate.slice(i, i + BATCH).map(({ _plant, ...row }) => row);
    const res = await prisma.client.createMany({ data: slice, skipDuplicates: true });
    created += res.count;
    process.stdout.write(`\r  insert ${Math.min(i + BATCH, toCreate.length)}/${toCreate.length}`);
  }
  console.log(`\nCreati: ${created}`);

  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += 50) {
    const slice = toUpdate.slice(i, i + 50);
    await Promise.all(slice.map(({ id, data }) => prisma.client.update({ where: { id }, data })));
    updated += slice.length;
    process.stdout.write(`\r  update ${updated}/${toUpdate.length}`);
  }
  console.log(`\nAggiornati: ${updated}`);

  const all = await prisma.client.findMany({
    where: { organizationId: tropini.id },
    select: {
      id: true, externalId: true, marcaStufa: true, modelloStufa: true, ultimaVisita: true,
    },
  });
  const plantByExt = new Map(toCreate.map((c) => [c.externalId, c._plant]));
  const plants = [];
  for (const c of all) {
    const extra = plantByExt.get(c.externalId);
    const marca = extra?.marca || c.marcaStufa;
    const modello = extra?.modello || c.modelloStufa;
    const matricola = extra?.matricola || null;
    const anno = extra?.anno || null;
    if (!marca && !modello && !matricola) continue;
    plants.push({
      organizationId: tropini.id,
      clientId: c.id,
      externalId: c.externalId,
      marca: marca || null,
      modello: modello || null,
      matricola,
      tipologia: "STUFA",
      annoInstallazione: anno,
      dataUltimoIntervento: extra?.ultima || c.ultimaVisita || null,
    });
  }

  if (plants.length) {
    await prisma.plant.deleteMany({
      where: { organizationId: tropini.id, externalId: { startsWith: "epim:" } },
    });
    await prisma.plant.deleteMany({
      where: { organizationId: tropini.id, externalId: { startsWith: "kml:" } },
    });
    for (let i = 0; i < plants.length; i += BATCH) {
      await prisma.plant.createMany({ data: plants.slice(i, i + BATCH) });
    }
    console.log(`Impianti: ${plants.length}`);
  }

  const withGeo = all.filter((c) => c).length;
  const geoCount = await prisma.client.count({
    where: { organizationId: tropini.id, lat: { not: null } },
  });
  const total = await prisma.client.count({ where: { organizationId: tropini.id } });
  console.log(`\n✓ Tropini Service — clienti ${total}, con GPS ${geoCount}`);
  void withGeo;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
