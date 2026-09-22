#!/usr/bin/env node
// Oracle du lab 05 NestJS : intervention sur une API existante. Régression (toujours verte)
// + nouvelle capacité (rouge → verte). Usage : node run-oracle.mjs lab | solution
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] === "solution" ? "solution" : "lab";
const FILES = ["posts.service.ts", "posts.controller.ts"];

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: HERE, encoding: "utf8", shell: true, stdio: "inherit" });
  return r.status === 0;
}

function swap(toSolution) {
  for (const name of FILES) {
    const src = join(HERE, "src/posts", name);
    const backup = join(HERE, "src/posts", `${name}.bak`);
    const solution = join(HERE, "solution/src/posts", name);
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
    console.log("— mode solution : posts.service.ts/posts.controller.ts remplacés par la référence —\n");
  }

  try {
    console.log("\n=== Non-régression (doit rester verte) + nouvelle capacité ===\n");
    if (!run("npx", ["jest", "--config", "jest-e2e.config.ts"])) {
      console.log("\n❌ RED\n");
      return 1;
    }
    console.log("\n✅ GREEN\n");
    return 0;
  } finally {
    if (mode === "solution") {
      swap(false);
      console.log("— fichiers restaurés à leur état de départ —");
    }
  }
}

process.exit(main());
