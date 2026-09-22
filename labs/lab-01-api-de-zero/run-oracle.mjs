#!/usr/bin/env node
// Oracle du lab 01 NestJS : unitaire (service + guard, dépendances mockées) puis e2e (la
// vraie app, de vraies requêtes HTTP). Usage : node run-oracle.mjs lab | solution
import { spawnSync } from "node:child_process";
import { cpSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] === "solution" ? "solution" : "lab";
const SRC = join(HERE, "src/families");
const BACKUP = join(HERE, "src/families.bak");
const SOLUTION = join(HERE, "solution/src/families");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: HERE, encoding: "utf8", shell: true, stdio: "inherit" });
  return r.status === 0;
}

function main() {
  if (mode === "solution") {
    cpSync(SRC, BACKUP, { recursive: true });
    rmSync(SRC, { recursive: true, force: true });
    cpSync(SOLUTION, SRC, { recursive: true });
    console.log("— mode solution : src/families/ temporairement remplacé par la référence —\n");
  }

  try {
    console.log("\n=== Couche 1/2 — unitaire (service + guard) ===\n");
    if (!run("npx", ["jest", "--config", "jest.config.ts"])) {
      console.log("\n❌ RED — la couche unitaire échoue.\n");
      return 1;
    }

    console.log("\n=== Couche 2/2 — e2e (vraie app, vraies requêtes HTTP) ===\n");
    if (!run("npx", ["jest", "--config", "jest-e2e.config.ts"])) {
      console.log("\n❌ RED — la couche e2e échoue.\n");
      return 1;
    }

    console.log("\n✅ GREEN — unitaire et e2e passent.\n");
    return 0;
  } finally {
    if (mode === "solution" && existsSync(BACKUP)) {
      rmSync(SRC, { recursive: true, force: true });
      cpSync(BACKUP, SRC, { recursive: true });
      rmSync(BACKUP, { recursive: true, force: true });
      console.log("— src/families/ restauré à son état de départ —");
    }
  }
}

process.exit(main());
