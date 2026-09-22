#!/usr/bin/env node
// Oracle du lab 08 NestJS : relire une PR API, corriger sur-affectation de masse + fuite de
// données sensibles. Régression (toujours verte) + findings (rouge → vert).
// Usage : node run-oracle.mjs lab | solution
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] === "solution" ? "solution" : "lab";
const FILES = ["users/dto/update-profile.dto.ts", "users/users.service.ts"];

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: HERE, encoding: "utf8", shell: true, stdio: "inherit" });
  return r.status === 0;
}

function swap(toSolution) {
  for (const rel of FILES) {
    const src = join(HERE, "src", rel);
    const backup = `${src}.bak`;
    const solution = join(HERE, "solution/src", rel);
    if (toSolution) {
      copyFileSync(src, backup);
      copyFileSync(solution, src);
    } else if (existsSync(backup)) {
      copyFileSync(backup, src);
      unlinkSync(backup);
    }
  }
}

function main() {
  if (mode === "solution") {
    swap(true);
    console.log("— mode solution : DTO + service remplacés par la référence corrigée —\n");
  }
  try {
    console.log("\n=== Non-régression + findings de la revue ===\n");
    if (!run("npx", ["jest", "--config", "jest-e2e.config.ts"])) {
      console.log("\n❌ RED\n");
      return 1;
    }
    console.log("\n✅ GREEN\n");
    return 0;
  } finally {
    if (mode === "solution") {
      swap(false);
      console.log("— fichiers restaurés à leur état de départ (PR non corrigée) —");
    }
  }
}

process.exit(main());
