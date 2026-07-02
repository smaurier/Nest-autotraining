# Lab 01 — Node.js event loop

> **Outcome :** à la fin, tu sais prédire l'ordre d'exécution complet (nextTick / Promise / setTimeout / setImmediate) et écrire un handler Node.js 22 non-bloquant avec vrai I/O.
> **Vrai outil :** Node.js 22 — `node order.mjs` / `node famille.mjs` (ESM natif, zéro dépendance).
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu travailles sur l'API TribuZen. Deux tâches indépendantes, dans l'ordre.

**Tâche 1 — Prédire, écrire, vérifier.**
Écris de zéro un fichier `order.mjs` (dans un dossier de travail local, pas dans ce repo) qui utilise les 4 APIs async Node.js : `process.nextTick`, `Promise.resolve().then()`, `setTimeout(fn, 0)`, `setImmediate`. Prédit la sortie sur papier *avant* d'exécuter. Compare. Si l'écart est non nul, explique pourquoi par écrit avant de continuer.

**Tâche 2 — Convertir le handler bloquant.**
La route `GET /familles/:id/membres` de TribuZen utilise `fs.readFileSync`. Réécris-la de façon non-bloquante avec `fs.promises.readFile`. Simule 3 requêtes simultanées via `Promise.all` et compare les durées avec `performance.now()`.

## Étapes (en friction)

1. Créer un dossier de travail local (`lab-01-work/` hors du repo). Créer `order.mjs` vide.
2. Sans documentation : écrire un snippet avec `nextTick`, `Promise.resolve().then()`, `setTimeout(0)`, `setImmediate` et un `console.log` synchrone. **Noter la prédiction sur papier avant d'exécuter.**
3. Exécuter : `node order.mjs`. Comparer sortie et prédiction. Expliquer chaque ligne.
4. Ajouter un `nextTick` imbriqué (un nextTick qui en enregistre un autre dans son callback). Prédire, exécuter, expliquer.
5. Créer `famille.mjs`. Créer les fichiers JSON fixtures (`familles/fam-1.json` etc. avec `{ "membres": [...] }`). Implémenter `getMembresBloquant(id)` avec `readFileSync` et `getMembresAsync(id)` avec `readFile` de `node:fs/promises`.
6. Mesurer les deux variantes avec `performance.now()`. Expliquer la différence en termes d'event loop (pas en termes de "c'est plus rapide").

## Corrigé complet commenté

### order.mjs

```js
// order.mjs — Node.js 22, ESM
import { nextTick } from 'node:process';

console.log('A');                               // synchrone : exécuté immédiatement sur le call stack

setTimeout(() => console.log('B'), 0);         // enregistré dans la phase timers (délai ≥ 1 ms)

setImmediate(() => console.log('C'));           // enregistré dans la phase check

nextTick(() => {
  console.log('D');                             // nextTick queue — vidée AVANT les microtasks
  nextTick(() => console.log('E'));             // nextTick imbriqué : s'exécute avant F/G car la
                                                // nextTick queue est drainée récursivement en entier
});

Promise.resolve()
  .then(() => console.log('F'))                 // microtask queue — après nextTick queue
  .then(() => console.log('G'));                // microtask chaîné — F résout → G devient disponible

console.log('H');                               // synchrone : call stack pas encore vide

// ─── Sortie garantie ─────────────────────────────────────────────────────────
// A    ← 1 : synchrone (call stack)
// H    ← 2 : synchrone (call stack)
// D    ← 3 : nextTick queue (priorité 1)
// E    ← 4 : nextTick imbriqué — la queue est drainée en entier avant les microtasks
// F    ← 5 : microtask queue (Promise.then), enregistré avant G
// G    ← 6 : microtask chaîné, disponible après résolution de F
// B    ← 7 : phase timers (setTimeout 0 ms)
// C    ← 8 : phase check (setImmediate) — après timers depuis le scope global
// ─────────────────────────────────────────────────────────────────────────────
// NOTE : l'ordre B / C n'est pas garanti dans le scope global (dépend du timing système).
// Dans un callback I/O, setImmediate précède TOUJOURS setTimeout(fn, 0).
```

### famille.mjs

```js
// famille.mjs — Node.js 22, ESM
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

// ── Fixtures : créer les fichiers JSON de test ──────────────────────────────
mkdirSync('./familles', { recursive: true });
['fam-1', 'fam-2', 'fam-3'].forEach((id, i) => {
  writeFileSync(
    `./familles/${id}.json`,
    JSON.stringify({ membres: [`membre-${i * 2 + 1}`, `membre-${i * 2 + 2}`] }),
  );
});

// ── VERSION BLOQUANTE ───────────────────────────────────────────────────────
// readFileSync maintient le call stack occupé pendant toute la lecture.
// Chaque appel dans ids.map(fn) attend que le précédent finisse.
// Durée totale ≈ T1 + T2 + T3.
// Pire : pendant ces lectures, l'event loop ne peut traiter aucune autre requête.
function getMembresBloquant(id) {
  const raw = readFileSync(`./familles/${id}.json`, 'utf-8'); // ← bloque le thread
  return JSON.parse(raw);
}

// ── VERSION NON-BLOQUANTE ───────────────────────────────────────────────────
// readFile délègue la lecture au thread pool libuv (4 workers par défaut).
// await suspend la fonction et libère le thread principal.
// L'event loop peut traiter d'autres requêtes pendant la lecture.
// Durée totale ≈ max(T1, T2, T3) — les 3 lectures tournent en parallèle dans libuv.
async function getMembresAsync(id) {
  const raw = await readFile(`./familles/${id}.json`, 'utf-8'); // ← non-bloquant
  return JSON.parse(raw);
}

// ── BENCHMARK ───────────────────────────────────────────────────────────────
const ids = ['fam-1', 'fam-2', 'fam-3'];

// Bloquant — séquentiel : chaque readFileSync termine avant le suivant
const t1 = performance.now();
ids.map(id => getMembresBloquant(id));
const duréeBloquant = performance.now() - t1;

// Non-bloquant — les 3 readFile partent simultanément vers le thread pool
const t2 = performance.now();
await Promise.all(ids.map(id => getMembresAsync(id)));
const duréeAsync = performance.now() - t2;

console.log(`Bloquant  : ${duréeBloquant.toFixed(3)} ms`);
console.log(`Async     : ${duréeAsync.toFixed(3)} ms`);

// Sur des petits fichiers locaux (disk cache actif), les chiffres sont proches.
// Ce qui compte : pendant duréeBloquant, l'event loop est figée pour TOUTES les requêtes.
// Pendant duréeAsync, l'event loop reste disponible — les 3 lectures tournent dans libuv.
// L'enjeu n'est pas la vitesse sur un seul client : c'est la disponibilité pour N clients simultanés.
```

Exécution :

```bash
# Node.js 22 — ESM natif, zéro dépendance externe
node order.mjs
node famille.mjs
```

## Variante J+30 (fading)

Même objectif, 20 min chrono, sans relire ce README.

Créer `recursive.mjs` :

1. Écrire une fonction `tick(n)` qui affiche `n` puis appelle `process.nextTick(() => tick(n - 1))` si `n > 0`.
2. Appeler `tick(3)` et `Promise.resolve().then(() => console.log('promise'))` dans le même script.
3. Prédire et expliquer par écrit pourquoi la Promise s'exécute avant ou après les ticks.
4. Ajouter un `setImmediate(() => console.log('immediate'))`. Prédire sa position dans l'output.

Réponse attendue : les ticks (3 → 2 → 1 → 0) s'exécutent tous avant la Promise, car la nextTick queue est drainée récursivement en entier avant la microtask queue. `'immediate'` apparaît en dernier — phase check, après la microtask queue et la phase timers (aucun timer ici).

## Application TribuZen

Dans `smaurier/tribuzen`, dossier `apps/api/src/famille/` :

```ts
// famille.service.ts — version non-bloquante
import { readFile } from 'node:fs/promises';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FamilleService {
  // Lecture non-bloquante : le thread principal reste libre pour d'autres requêtes
  // libuv gère la lecture dans le thread pool
  async getMembres(id: string): Promise<Membre[]> {
    const raw = await readFile(`./cache/${id}.json`, 'utf-8');
    return JSON.parse(raw) as Membre[];
  }

  // Profils ET droits chargés simultanément via Promise.all
  // Durée ≈ max(T_membres, T_droits) au lieu de T_membres + T_droits
  async getFamilleComplete(id: string): Promise<FamilleComplete> {
    const [membres, droits] = await Promise.all([
      this.getMembres(id),
      this.droitsService.getDroits(id),
    ]);
    return { membres, droits };
  }
}
```

Commit suggéré : `feat(famille): getMembres non-bloquant — fs.promises.readFile`.

Le pattern `async/await` + `Promise.all` ici est identique à ce que TypeORM appliquera au module 04 pour les requêtes PostgreSQL — remplacer `readFile` par un `this.repo.findOne(...)` et le principe reste entier.
