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

const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});

process.exit(result.status ?? 1);
