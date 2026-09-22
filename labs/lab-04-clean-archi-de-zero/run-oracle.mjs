#!/usr/bin/env node
// Oracle du lab 04 NestJS : trois tests de frontière dans l'ordre — domaine pur, application
// (faux port), e2e (vrai câblage). Usage : node run-oracle.mjs lab | solution
import { spawnSync } from "node:child_process";
import { cpSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] === "solution" ? "solution" : "lab";
const DIRS = ["domain", "application", "infrastructure"];

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
    console.log("— mode solution : src/{domain,application,infrastructure}/ remplacés par la référence —\n");
  }

  try {
    console.log("\n=== Frontière 1/3 — domaine (zéro dépendance) ===\n");
    if (!run("npx", ["jest", "--config", "jest.config.ts", "streak.spec.ts"])) {
      console.log("\n❌ RED — le domaine échoue.\n");
      return 1;
    }

    console.log("\n=== Frontière 2/3 — application (faux port) ===\n");
    if (!run("npx", ["jest", "--config", "jest.config.ts", "complete-routine.usecase.spec.ts"])) {
      console.log("\n❌ RED — l'application échoue.\n");
      return 1;
    }

    console.log("\n=== Frontière 3/3 — e2e (vrai câblage) ===\n");
    if (!run("npx", ["jest", "--config", "jest-e2e.config.ts"])) {
      console.log("\n❌ RED — l'e2e échoue.\n");
      return 1;
    }

    console.log("\n✅ GREEN — les trois frontières passent.\n");
    return 0;
  } finally {
    if (mode === "solution") {
      swap(false);
      console.log("— src/{domain,application,infrastructure}/ restaurés à leur état de départ —");
    }
  }
}

process.exit(main());
