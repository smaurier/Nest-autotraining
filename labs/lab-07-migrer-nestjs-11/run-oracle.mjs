#!/usr/bin/env node
// Oracle du lab 07 NestJS : migration réelle de dépendances. `lab` teste ton dossier
// starter/ (tel que tu l'as modifié) ; `solution` teste solution/ (référence figée,
// déjà migrée). Chacun a son propre node_modules (installe-les séparément si besoin,
// voir README).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] === "solution" ? "solution" : "lab";
const DIR = join(HERE, mode === "solution" ? "solution" : "starter");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: DIR, encoding: "utf8", shell: true, stdio: "inherit" });
  return r.status === 0;
}

function main() {
  if (!existsSync(join(DIR, "node_modules"))) {
    console.log(`\n❌ ${mode === "solution" ? "solution/" : "starter/"} n'a pas de node_modules. Lance d'abord :\n   cd 09-nestjs/labs/lab-07-migrer-nestjs-11/${mode === "solution" ? "solution" : "starter"} && npm install\n`);
    return 1;
  }

  console.log(`\n=== ${mode === "solution" ? "solution/" : "starter/"} — unitaire ===\n`);
  if (!run("npx", ["jest", "--config", "jest.config.ts"])) {
    console.log("\n❌ RED — la couche unitaire échoue (ou ne trouve aucun test).\n");
    return 1;
  }

  console.log(`\n=== ${mode === "solution" ? "solution/" : "starter/"} — e2e ===\n`);
  if (!run("npx", ["jest", "--config", "jest-e2e.config.ts"])) {
    console.log("\n❌ RED — la couche e2e échoue.\n");
    return 1;
  }

  console.log("\n✅ GREEN\n");
  return 0;
}

process.exit(main());
