#!/usr/bin/env node
// Oracle du lab 06 NestJS : reproduire puis corriger une faille d'autorisation. Régression
// (comportement légitime, toujours vert) + faille (rouge → verte). Usage : lab | solution
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] === "solution" ? "solution" : "lab";
const NAME = "posts.controller.ts";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: HERE, encoding: "utf8", shell: true, stdio: "inherit" });
  return r.status === 0;
}

function swap(toSolution) {
  const src = join(HERE, "src/posts", NAME);
  const backup = join(HERE, "src/posts", `${NAME}.bak`);
  const solution = join(HERE, "solution/src/posts", NAME);
  if (toSolution) {
    copyFileSync(src, backup);
    copyFileSync(solution, src);
  } else if (existsSync(backup)) {
    copyFileSync(backup, src);
    unlinkSync(backup);
  }
}

function main() {
  if (mode === "solution") {
    swap(true);
    console.log("— mode solution : posts.controller.ts remplacé par la référence corrigée —\n");
  }
  try {
    console.log("\n=== Non-régression (comportement légitime) + faille rapportée ===\n");
    if (!run("npx", ["jest", "--config", "jest-e2e.config.ts"])) {
      console.log("\n❌ RED\n");
      return 1;
    }
    console.log("\n✅ GREEN\n");
    return 0;
  } finally {
    if (mode === "solution") {
      swap(false);
      console.log("— posts.controller.ts restauré à son état de départ (vulnérable) —");
    }
  }
}

process.exit(main());
