#!/usr/bin/env node
/**
 * Esegue `prisma migrate deploy` senza dipendere da npx/.bin
 * (necessario nell'immagine Docker standalone dove npx non trova prisma).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaCli = path.join(root, "node_modules/prisma/build/index.js");

if (!existsSync(prismaCli)) {
  console.error(
    "[db:migrate] Prisma CLI non trovato in node_modules/prisma.\n" +
      "Ricostruisci l'immagine Docker (standalone sovrascrive node_modules se prisma è copiato prima)."
  );
  process.exit(1);
}

function prisma(args) {
  return spawnSync(process.execPath, [prismaCli, ...args], {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });
}

let result = prisma(["migrate", "deploy"]);
if (result.status !== 0) {
  // P3009: una migrazione restata "failed" blocca i deploy successivi.
  // 20261005153000 è fallita per un BOM nel file SQL; la transazione non ha applicato nulla.
  const resolved = prisma([
    "migrate",
    "resolve",
    "--rolled-back",
    "20261005153000_ai_day_plans",
  ]);
  if (resolved.status === 0) result = prisma(["migrate", "deploy"]);
}

process.exit(result.status ?? 1);
