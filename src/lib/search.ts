import type { Prisma } from "@prisma/client";

const INS = "insensitive" as const;

function contains(token: string) {
  return { contains: token, mode: INS };
}

/** Campi anagrafici (non le note: troppo rumorose per la ricerca). */
function tokenMatches(token: string): Prisma.ClientWhereInput {
  const or: Prisma.ClientWhereInput[] = [
    { nome: contains(token) },
    { cognome: contains(token) },
    { ragioneSociale: contains(token) },
    { codiceCliente: contains(token) },
    { codiceFiscale: contains(token) },
    { partitaIva: contains(token) },
    { email: contains(token) },
    { telefono: contains(token) },
    { telefono2: contains(token) },
    { indirizzo: contains(token) },
    { civico: contains(token) },
    { cap: contains(token) },
    { citta: contains(token) },
    { provincia: contains(token) },
    { marcaStufa: contains(token) },
    { modelloStufa: contains(token) },
  ];
  const digits = token.replace(/\D/g, "");
  if (digits.length >= 4) {
    const tail7 = digits.slice(-7);
    const tail6 = digits.slice(-6);
    if (tail7 !== token) {
      or.push({ telefono: contains(tail7) }, { telefono2: contains(tail7) });
    }
    if (tail6 !== token && tail6 !== tail7) {
      or.push({ telefono: contains(tail6) }, { telefono2: contains(tail6) });
    }
  }
  return { OR: or };
}

export function clientSearchWhere(raw: string): Prisma.ClientWhereInput | undefined {
  const q = raw.trim();
  if (!q) return undefined;
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 8);
  if (tokens.length === 1) return tokenMatches(tokens[0]);
  return { AND: tokens.map(tokenMatches) };
}

export function rankClientMatch(
  c: { nome: string; cognome: string; ragioneSociale?: string | null },
  raw: string
): number {
  const q = raw.trim().toLowerCase();
  if (!q) return 9;
  const nome = (c.nome ?? "").toLowerCase();
  const cognome = (c.cognome ?? "").toLowerCase();
  const rs = (c.ragioneSociale ?? "").toLowerCase();
  const full = `${cognome} ${nome}`.trim();
  const fullRev = `${nome} ${cognome}`.trim();
  if (cognome === q || nome === q || full === q || fullRev === q) return 0;
  if (cognome.startsWith(q) || nome.startsWith(q) || rs.startsWith(q)) return 1;
  if (full.startsWith(q) || fullRev.startsWith(q)) return 1;
  if (cognome.includes(q) || nome.includes(q) || rs.includes(q)) return 2;
  if (full.includes(q) || fullRev.includes(q)) return 2;
  return 5;
}

export function interventoSearchWhere(raw: string): Prisma.InterventoWhereInput | undefined {
  const q = raw.trim();
  if (!q) return undefined;
  const client = clientSearchWhere(q);
  return {
    OR: [
      { descrizione: contains(q) },
      { note: contains(q) },
      ...(client ? [{ client }] : []),
      {
        plant: {
          OR: [{ marca: contains(q) }, { modello: contains(q) }, { matricola: contains(q) }],
        },
      },
    ],
  };
}
