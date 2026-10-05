import { prisma } from "./prisma";

const CSV_URL = "https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv";
const DAY_MS = 24 * 60 * 60 * 1000;

const memory = new Map<string, { price: number; at: number }>();

function cacheKey(organizationId: string, fuel: string) {
  return `${organizationId}:${fuel.toLowerCase()}`;
}

/** Media nazionale self-service dal CSV aperto del MIMIT (nessuna chiave). */
export async function averageSelfService(fuel: string): Promise<number | null> {
  const res = await fetch(CSV_URL, {
    signal: AbortSignal.timeout(25_000),
    headers: { "User-Agent": "PlannerTropini/1.0" },
  });
  if (!res.ok || !res.body) return null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  let header: string[] | null = null;
  let sep = "|";
  let iFuel = -1;
  let iPrice = -1;
  let iSelf = -1;
  let sum = 0;
  let n = 0;
  const want = fuel.trim().toLowerCase();

  const consume = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || /^estrazione/i.test(trimmed)) return;
    if (!header) {
      sep = trimmed.includes("|") ? "|" : trimmed.includes(";") ? ";" : ",";
      header = trimmed.split(sep).map((s) => s.trim().toLowerCase().replace(/^\ufeff/, ""));
      iFuel = header.findIndex((c) => c.includes("carburante"));
      iPrice = header.findIndex((c) => c === "prezzo" || c.endsWith("prezzo"));
      iSelf = header.findIndex((c) => c === "isself" || c.includes("self"));
      return;
    }
    if (iFuel < 0 || iPrice < 0) return;
    const parts = trimmed.split(sep);
    if ((parts[iFuel] ?? "").trim().toLowerCase() !== want) return;
    if (iSelf >= 0 && (parts[iSelf] ?? "").trim() !== "1") return;
    const price = Number((parts[iPrice] ?? "").replace(",", ".").trim());
    if (price > 0.4 && price < 6) {
      sum += price;
      n += 1;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl = buf.indexOf("\n");
    while (nl >= 0) {
      consume(buf.slice(0, nl).replace(/\r$/, ""));
      buf = buf.slice(nl + 1);
      nl = buf.indexOf("\n");
    }
  }
  if (buf.trim()) consume(buf);
  if (!n) return null;
  return Math.round((sum / n) * 1000) / 1000;
}

export function fuelCostEuro(km: number, consumoL100: number, price: number | null) {
  if (price == null || km <= 0) return 0;
  return Math.round(km * (consumoL100 / 100) * price * 100) / 100;
}

export async function currentFuelPrice(organizationId: string, force = false) {
  const settings = await prisma.settings.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId },
  });
  const fuel = settings.fuelType || "Gasolio";
  const cachedAt = settings.fuelPriceAt?.getTime() ?? 0;
  const fresh = settings.fuelPrice != null && Date.now() - cachedAt < DAY_MS;
  const mem = memory.get(cacheKey(organizationId, fuel));
  if (!force && mem && Date.now() - mem.at < DAY_MS) {
    return pack(settings.consumoL100, fuel, mem.price, new Date(mem.at).toISOString(), "cache");
  }
  if (!force && fresh && settings.fuelPrice != null) {
    memory.set(cacheKey(organizationId, fuel), { price: settings.fuelPrice, at: cachedAt });
    return pack(settings.consumoL100, fuel, settings.fuelPrice, settings.fuelPriceAt!.toISOString(), "cache");
  }
  try {
    const price = await averageSelfService(fuel);
    if (price != null) {
      const at = new Date();
      await prisma.settings.update({
        where: { organizationId },
        data: { fuelPrice: price, fuelPriceAt: at },
      });
      memory.set(cacheKey(organizationId, fuel), { price, at: at.getTime() });
      return pack(settings.consumoL100, fuel, price, at.toISOString(), "mimit");
    }
  } catch {
    /* resta l'ultimo prezzo salvato */
  }
  if (settings.fuelPrice != null) {
    return pack(settings.consumoL100, fuel, settings.fuelPrice, settings.fuelPriceAt?.toISOString() ?? null, "ultimo");
  }
  return pack(settings.consumoL100, fuel, null, null, "mancante");
}

function pack(
  consumoL100: number,
  fuel: string,
  price: number | null,
  at: string | null,
  source: "mimit" | "cache" | "ultimo" | "mancante"
) {
  return { consumoL100, fuel, price, at, source };
}
