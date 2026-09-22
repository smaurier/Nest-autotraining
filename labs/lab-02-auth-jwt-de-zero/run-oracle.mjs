#!/usr/bin/env node
// Oracle du lab 02 NestJS : unitaire (service + guard, dépendances mockées) puis e2e (la
// vraie app, de vraies requêtes HTTP). Usage : node run-oracle.mjs lab | solution
import { spawnSync } from "node:child_process";
import { cpSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] === "solution" ? "solution" : "lab";
// Deux dossiers écrits par l'étudiant dans ce lab (pas un seul comme au lab 01).
const DIRS = ["users", "auth"];

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: HERE, encoding: "utf8", shell: true, stdio: "inherit" });
  return r.status === 0;
}

function swap(toSolution) {
  for (const dir of DIRS) {
    const src = join(HERE, "src", dir);
    const backup = join(HERE, "src", `${dir}.bak`);
    const solution = join(HERE, "solution/src", dir);
    if (toSolution) {
      cpSync(src, backup, { recursive: true });
      rmSync(src, { recursive: true, force: true });
      cpSync(solution, src, { recursive: true });
    } else if (existsSync(backup)) {
      rmSync(src, { recursive: true, force: true });
      cpSync(backup, src, { recursive: true });
      rmSync(backup, { recursive: true, force: true });
    }
  }
}

function main() {
  if (mode === "solution") {
    swap(true);
    console.log("— mode solution : src/{users,auth}/ temporairement remplacés par la référence —\n");
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
    if (mode === "solution") {
      swap(false);
      console.log("— src/{users,auth}/ restaurés à leur état de départ —");
    }
  }
}

process.exit(main());
