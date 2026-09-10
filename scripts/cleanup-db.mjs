/**
 * Pulizia database clienti: duplicati, record vuoti, città errate.
 *
 * Usage:
 *   node scripts/cleanup-db.mjs           # esegue pulizia
 *   node scripts/cleanup-db.mjs --dry-run # solo anteprima
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

function norm(s) {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normPhone(p) {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length >= 6 ? d : "";
}

function coordKey(c) {
  return c.lat != null && c.lng != null
    ? `${c.lat.toFixed(5)}|${c.lng.toFixed(5)}`
    : "";
}

function score(c) {
  let s = 0;
  if (c.lat != null) s += 8;
  if (c.telefono) s += 4;
  if (c.telefono2) s += 2;
  if (c.indirizzo) s += 4;
  if (c.citta) s += 2;
  if (c.marcaStufa) s += 2;
  if (c.modelloStufa) s += 1;
  if (c.ultimaVisita) s += 2;
  if (c.note) s += 1;
  if (c.stato === "ATTIVO") s += 1;
  if (norm(c.nome)) s += 1;
  if (!c.urgente) s += 0;
  return s;
}

function pickKeeper(group) {
  return [...group].sort((a, b) => score(b) - score(a) || a.id - b.id)[0];
}

function isJunk(c) {
  const cn = norm(c.cognome);
  return cn === "senza nome" || cn === "senza indirizzo" || cn === "unknown";
}

function isEmptyStub(c) {
  if (norm(c.nome)) return false;
  return (
    !normPhone(c.telefono) &&
    !normPhone(c.telefono2) &&
    !norm(c.indirizzo) &&
    !norm(c.citta) &&
    c.lat == null &&
    !norm(c.marcaStufa) &&
    !c.ultimaVisita &&
    !norm(c.note) &&
    !c.urgente
  );
}

function needsCityFix(c) {
  const city = norm(c.citta);
  if (!city) return false;
  return city === norm(c.nome) || city === norm(c.cognome);
}

function collectDuplicateIds(clients) {
  const toRemove = new Set();
  const reasons = [];

  function markRemove(c, keeper, reason) {
    if (c.id === keeper.id || toRemove.has(c.id)) return;
    toRemove.add(c.id);
    reasons.push({ id: c.id, keeper: keeper.id, reason, label: `${c.cognome} ${c.nome}`.trim() });
  }

  function dedupeGroups(groups, reason) {
    for (const group of groups) {
      const alive = group.filter((c) => !toRemove.has(c.id));
      if (alive.length <= 1) continue;
      const keeper = pickKeeper(alive);
      for (const c of alive) markRemove(c, keeper, reason);
    }
  }

  for (const c of clients) {
    if (isJunk(c)) {
      toRemove.add(c.id);
      reasons.push({ id: c.id, keeper: null, reason: "junk", label: c.cognome });
    }
  }

  for (const c of clients) {
    if (isEmptyStub(c)) {
      toRemove.add(c.id);
      reasons.push({ id: c.id, keeper: null, reason: "empty-stub", label: c.cognome });
    }
  }

  const byFingerprint = new Map();
  for (const c of clients) {
    if (toRemove.has(c.id)) continue;
    const key = [
      norm(c.cognome),
      norm(c.nome),
      normPhone(c.telefono),
      norm(c.indirizzo),
      norm(c.citta),
      coordKey(c),
    ].join("|");
    if (!byFingerprint.has(key)) byFingerprint.set(key, []);
    byFingerprint.get(key).push(c);
  }
  dedupeGroups([...byFingerprint.values()].filter((g) => g.length > 1), "exact-duplicate");

  const byAddr = new Map();
  for (const c of clients) {
    if (toRemove.has(c.id)) continue;
    const addr = norm(c.indirizzo);
    if (!addr) continue;
    const key = [norm(c.cognome), norm(c.nome), addr, norm(c.citta)].join("|");
    if (!byAddr.has(key)) byAddr.set(key, []);
    byAddr.get(key).push(c);
  }
  dedupeGroups([...byAddr.values()].filter((g) => g.length > 1), "same-address");

  const byPhone = new Map();
  for (const c of clients) {
    if (toRemove.has(c.id)) continue;
    const phone = normPhone(c.telefono);
    if (!phone) continue;
    const key = [norm(c.cognome), norm(c.nome), phone].join("|");
    if (!byPhone.has(key)) byPhone.set(key, []);
    byPhone.get(key).push(c);
  }
  dedupeGroups([...byPhone.values()].filter((g) => g.length > 1), "same-phone");

  const byCoordName = new Map();
  for (const c of clients) {
    if (toRemove.has(c.id)) continue;
    const ck = coordKey(c);
    if (!ck) continue;
    const key = [ck, norm(c.cognome), norm(c.nome)].join("|");
    if (!byCoordName.has(key)) byCoordName.set(key, []);
    byCoordName.get(key).push(c);
  }
  dedupeGroups([...byCoordName.values()].filter((g) => g.length > 1), "same-coords");

  return { toRemove, reasons };
}

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  const summary = {
    dryRun,
    at: new Date().toISOString(),
    orgs: [],
  };

  for (const org of orgs) {
    const clients = await prisma.client.findMany({
      where: { organizationId: org.id },
      orderBy: { id: "asc" },
    });

    const { toRemove, reasons } = collectDuplicateIds(clients);
    const cityFixes = clients.filter((c) => !toRemove.has(c.id) && needsCityFix(c));

    const orgSummary = {
      name: org.name,
      before: clients.length,
      removed: toRemove.size,
      cityFixes: cityFixes.length,
      after: clients.length - toRemove.size,
      sampleRemovals: reasons.slice(0, 15),
    };
    summary.orgs.push(orgSummary);

    console.log(`\n=== ${org.name} ===`);
    console.log(`Clienti: ${orgSummary.before} → ${orgSummary.after}`);
    console.log(`Rimossi: ${orgSummary.removed} (duplicati/vuoti)`);
    console.log(`Città corrette: ${orgSummary.cityFixes}`);

    if (dryRun) continue;

    const backupPath = `scripts/backup-removed-${org.id}-${Date.now()}.json`;
    const removedRecords = clients.filter((c) => toRemove.has(c.id));
    writeFileSync(backupPath, JSON.stringify(removedRecords, null, 2));
    console.log(`Backup rimossi: ${backupPath}`);

    const removeIds = [...toRemove];
    if (removeIds.length > 0) {
      await prisma.client.deleteMany({
        where: { id: { in: removeIds }, organizationId: org.id },
      });
    }

    for (const c of cityFixes) {
      await prisma.client.update({
        where: { id: c.id },
        data: { citta: null },
      });
    }

    const routes = await prisma.routeHistory.findMany({
      where: { organizationId: org.id },
    });
    let routesUpdated = 0;
    for (const route of routes) {
      const filtered = route.clientIds.filter((id) => !toRemove.has(id));
      if (filtered.length !== route.clientIds.length) {
        if (filtered.length === 0) {
          await prisma.routeHistory.delete({ where: { id: route.id } });
        } else {
          await prisma.routeHistory.update({
            where: { id: route.id },
            data: {
              clientIds: filtered,
              stopCount: filtered.length,
            },
          });
        }
        routesUpdated++;
      }
    }
    console.log(`Percorsi aggiornati/rimossi: ${routesUpdated}`);
  }

  console.log("\n--- RIEPILOGO ---");
  for (const o of summary.orgs) {
    console.log(`${o.name}: ${o.before} → ${o.after} (-${o.removed}, ${o.cityFixes} città fix)`);
  }

  if (dryRun) {
    console.log("\n(dry-run: nessuna modifica applicata)");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
