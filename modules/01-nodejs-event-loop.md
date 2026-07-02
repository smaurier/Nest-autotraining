---
titre: Node.js event loop
cours: 09-nestjs
notions: [event loop et ses phases, libuv, call stack, non-blocking I/O, microtasks vs macrotasks, process.nextTick vs setImmediate vs setTimeout, ordre d'exécution, blocage du thread principal]
outcomes: [expliquer les phases de l'event loop, prédire l'ordre d'exécution nextTick/Promise/setTimeout/setImmediate, éviter de bloquer le thread principal]
prerequis: [00-prerequis-et-monde-backend]
next: 02-nodejs-modules-et-fs
libs: [{ name: node, version: "22" }]
tribuzen: comprendre l'asynchrone de l'API TribuZen (I/O non bloquant sur les requêtes famille)
last-reviewed: 2026-07
---

# Node.js event loop

> **Outcomes — tu sauras FAIRE :** expliquer les 6 phases de l'event loop et l'ordre exact d'exécution (nextTick / Promise / setTimeout / setImmediate), prédire la sortie d'un snippet asynchrone, identifier et corriger un blocage du thread principal.
> **Difficulté :** :star::star:

## 1. Cas concret d'abord

Tu ouvres le dossier `apps/api` du projet TribuZen. La route qui retourne les membres d'une famille est déjà en place, mais l'équipe se plaint que l'API entière "freeze" dès qu'une grande famille est chargée :

```ts
// apps/api/src/famille/famille.controller.ts — VERSION PROBLÉMATIQUE
import * as fs from 'node:fs';
import { Controller, Get, Param } from '@nestjs/common';

@Controller('familles')
export class FamilleController {
  @Get(':id/membres')
  getMembres(@Param('id') id: string) {
    // readFileSync BLOQUE le thread principal pendant toute la durée de la lecture
    const data = fs.readFileSync(`./cache/${id}.json`, 'utf-8');
    return JSON.parse(data);
  }
}
```

Si cinquante familles envoient une requête simultanément, les 49 premières attendent que la 1ère finisse de lire. Pas parce que Node.js est lent — parce que `readFileSync` verrouille le **seul thread** de l'event loop.

Ce module explique pourquoi, et comment l'event loop garantit que la version non-bloquante peut traiter les 50 requêtes sans jamais s'arrêter.

## 2. Théorie complète, concise

### 2.1 Le call stack

Node.js exécute JavaScript dans un **thread unique** (le thread principal). Le **call stack** est la pile LIFO qui trace les appels de fonction en cours. Chaque appel *empile* un frame ; chaque `return` *dépile* un frame.

```ts
function lireCache(id: string): object {
  // readFileSync tourne ici : le frame reste sur le call stack jusqu'à la fin de la lecture
  const raw = fs.readFileSync(`./cache/${id}.json`, 'utf-8');
  return JSON.parse(raw);
}

function getMembres(id: string): object {
  return lireCache(id);
  // call stack pendant la lecture : getMembres → lireCache → readFileSync
}
```

Tant que `readFileSync` s'exécute, le call stack n'est **jamais vide**. L'event loop attend que le call stack se vide avant de traiter quoi que ce soit d'autre — aucune autre requête HTTP, aucun timer, aucun callback I/O.

### 2.2 Architecture — V8, Node.js Bindings, libuv

```
  Code JavaScript (ton application)
         │
     V8 Engine           ← exécute JS, gère le call stack et la mémoire (GC)
         │
  Node.js Bindings       ← pont C/C++ entre JS et l'OS
         │
      libuv              ← event loop 6 phases, thread pool, I/O async cross-platform
```

**V8** exécute le JS et maintient le call stack. **libuv** est la bibliothèque C qui fournit à Node.js son event loop, un thread pool de 4 workers par défaut, et des abstractions réseau/fichier cross-platform (epoll sur Linux, IOCP sur Windows, kqueue sur macOS).

### 2.3 Les 6 phases de l'event loop (libuv)

Quand le call stack est vide, libuv entre dans la boucle et parcourt les phases dans cet ordre à chaque itération :

```
   ┌──────────────────────┐
┌─▶│  1. timers           │  setTimeout, setInterval — callbacks dont le délai a expiré
│  └──────────┬───────────┘
│  ┌──────────▼───────────┐
│  │  2. pending callbacks│  erreurs I/O différées (ex. ECONNREFUSED TCP)
│  └──────────┬───────────┘
│  ┌──────────▼───────────┐
│  │  3. idle / prepare   │  usage interne Node.js — pas de callbacks utilisateur
│  └──────────┬───────────┘
│  ┌──────────▼───────────┐
│  │  4. poll             │  récupère les nouveaux événements I/O (fs, network)
│  │                      │  peut bloquer ici si aucun timer n'expire et queue vide
│  └──────────┬───────────┘
│  ┌──────────▼───────────┐
│  │  5. check            │  setImmediate — s'exécute après la phase poll
│  └──────────┬───────────┘
│  ┌──────────▼───────────┐
│  │  6. close callbacks  │  socket.on('close'), server.close callbacks
│  └──────────┬───────────┘
└─────────────┘
```

**Entre chaque phase** : Node.js vide deux files prioritaires avant de passer à la phase suivante — la nextTick queue d'abord, puis la microtask queue (Promises). Voir §2.4.

La phase **poll** est centrale : c'est ici que l'event loop attend les résultats I/O. Quand un `readFile` se termine, libuv place son callback dans la poll queue. Si `setImmediate` est enregistré, Node.js quitte poll immédiatement et passe au check.

### 2.4 nextTick queue et microtask queue — l'ordre exact

Il existe **deux files d'attente async** qui s'exécutent avant tout macrotask (timer, I/O, check) :

| File | Alimentée par | Priorité |
|---|---|---|
| nextTick queue | `process.nextTick(fn)` | **1 — la plus haute** |
| microtask queue | `Promise.then`, `async/await`, `queueMicrotask` | **2** |

Node.js vide la nextTick queue **entièrement** (y compris les nextTick imbriqués, récursivement) avant de toucher la microtask queue. Puis vide la microtask queue avant d'avancer vers la prochaine phase de l'event loop.

Ordre exact garanti par Node.js 22 (vérifié Context7 `/nodejs/node`, `node:process` docs) :

```ts
// Exemple canonique de la doc Node.js 22
import { nextTick } from 'node:process';

Promise.resolve().then(() => console.log('resolve'));   // → microtask queue
queueMicrotask(() => console.log('microtask'));         // → microtask queue
nextTick(() => console.log('nextTick'));                // → nextTick queue

// Sortie :
// nextTick    ← 1 : nextTick queue drainée avant les microtasks
// resolve     ← 2 : microtask queue, ordre d'enregistrement
// microtask   ← 3 : microtask queue, enregistré après resolve
```

Schéma complet d'un tick :

```
[call stack vide]
  → nextTick queue  (drainée entièrement, récursivement)
  → microtask queue (Promise.then / queueMicrotask, récursivement)
  → prochaine phase event loop
    → entre chaque phase : nextTick + microtask vidées à nouveau
```

### 2.5 Non-blocking I/O

Quand Node.js appelle `fs.readFile(path, cb)`, libuv délègue la lecture au **thread pool** (ou à l'OS directement pour les sockets TCP). Le thread principal est immédiatement libéré, reprend la prochaine tâche disponible, et le callback est placé en poll queue quand la lecture se termine.

```ts
import { readFile } from 'node:fs/promises';

// Non-bloquant : le thread principal n'attend PAS la fin de la lecture
async function getMembresAsync(id: string): Promise<object> {
  // await suspend la fonction et libère le thread — l'event loop continue
  const raw = await readFile(`./cache/${id}.json`, 'utf-8');
  // Cette ligne s'exécute dans la microtask queue une fois la lecture terminée
  return JSON.parse(raw);
}
```

Règle : toute API Node.js async (`fs.promises`, `node:net`, `node:http`, `crypto` async) libère le thread principal pendant l'attente. Les variantes `*Sync` (`readFileSync`, `execSync`) le bloquent jusqu'à leur retour.

### 2.6 Thread pool libuv

Certaines opérations ne peuvent pas être async au niveau OS. libuv les exécute dans un **thread pool** de 4 workers par défaut, hors du thread principal.

| Opération | Mécanisme |
|---|---|
| `fs.readFile` | Thread pool libuv |
| `dns.lookup` | Thread pool libuv |
| `crypto.pbkdf2` / `crypto.scrypt` | Thread pool libuv |
| TCP / HTTP sockets | Async OS natif (epoll / IOCP / kqueue) |
| `dns.resolve` | Async OS natif (c-ares) |

```ts
// Augmenter la taille du pool pour des workloads crypto lourds
// Doit être défini AVANT tout import (module scope)
process.env.UV_THREADPOOL_SIZE = '8'; // défaut : 4, max : 1024

// Avec 4 threads : 4 pbkdf2 simultanés finissent quasi en même temps (~300 ms)
// Le 5e attend qu'un thread se libère → durée ~600 ms
```

### 2.7 Blocage du thread principal

Le thread principal est bloqué quand du code **synchrone long** occupe le call stack. Pendant ce temps, aucun I/O callback, aucun timer, aucune requête HTTP entrante ne peut être traité.

```ts
// ❌ I/O synchrone dans un handler HTTP — bloque pendant toute la lecture
const data = fs.readFileSync('./large-file.json', 'utf-8');

// ❌ Calcul CPU intensif synchrone — bloque ~100 ms
const hashed = crypto.scryptSync(password, salt, 64);

// ❌ Boucle longue sur le call stack — bloque ~1 s
for (let i = 0; i < 1_000_000_000; i++) { /* no-op */ }

// ✅ Toujours utiliser les variantes async
const data = await fs.promises.readFile('./large-file.json', 'utf-8');
const hashed = await new Promise<Buffer>((resolve, reject) =>
  crypto.scrypt(password, salt, 64, (err, buf) => err ? reject(err) : resolve(buf))
);
```

Estimation concrète : `readFileSync` sur un fichier de 10 Mo bloque l'event loop ~8 ms. À 1000 requêtes/s, l'API est saturée à ~12 req/s au lieu de 1000+.

## 3. Worked examples

### Exemple A — Prédire l'ordre d'un snippet complet

Exercice : prédire la sortie AVANT d'exécuter.

```ts
// order-prediction.mjs
import { nextTick } from 'node:process';

console.log('A');                            // synchrone

setTimeout(() => console.log('B'), 0);      // enregistré dans la phase timers

setImmediate(() => console.log('C'));        // enregistré dans la phase check

nextTick(() => {
  console.log('D');                          // nextTick queue
  nextTick(() => console.log('E'));          // nextTick imbriqué — vidé avant microtasks
});

Promise.resolve()
  .then(() => console.log('F'))             // microtask queue
  .then(() => console.log('G'));            // microtask chaîné — disponible après F

console.log('H');                            // synchrone
```

Pas-à-pas :

1. **Call stack** : `console.log('A')` → **A**. Les 4 APIs async sont *enregistrées*, pas encore appelées. `console.log('H')` → **H**.
2. **Call stack vide → nextTick queue** : **D**. `D` enregistre un nextTick imbriqué → **E** s'exécute avant de passer aux microtasks (nextTick queue drainée entièrement).
3. **nextTick queue vide → microtask queue** : **F** (premier `.then`). Ce `.then` résout, le suivant devient disponible → **G**.
4. **Microtasks épuisées → phase timers** : **B** (setTimeout 0 ms expiré).
5. **Phase check** : **C** (setImmediate).

Sortie garantie :

```
A
H
D
E
F
G
B
C
```

> **Nuance B vs C** : appelés depuis le scope global (hors callback I/O), l'ordre de `B` (setTimeout) et `C` (setImmediate) n'est pas garanti par la spec — il dépend du timing système au moment où la phase timers démarre. Dans un callback I/O, `setImmediate` précède toujours `setTimeout(fn, 0)` — voir piège n°4.

### Exemple B — Handler TribuZen bloquant → non-bloquant

```ts
// === VERSION BLOQUANTE ===
import * as fs from 'node:fs';

// Le thread principal est immobilisé jusqu'à la fin de readFileSync
// Aucune autre requête ne peut être traitée pendant ce temps
function getMembresBloquant(id: string): object {
  const raw = fs.readFileSync(`./cache/${id}.json`, 'utf-8'); // ← bloque
  return JSON.parse(raw);
}
```

```ts
// === VERSION NON-BLOQUANTE ===
import { readFile } from 'node:fs/promises';

// await suspend la fonction et libère le thread principal
// libuv délègue la lecture au thread pool — l'event loop continue
async function getMembresAsync(id: string): Promise<object> {
  const raw = await readFile(`./cache/${id}.json`, 'utf-8'); // ← non-bloquant
  return JSON.parse(raw);                                     // exécuté en microtask après lecture
}
```

```ts
// Simulation de 3 requêtes simultanées
const ids = ['fam-1', 'fam-2', 'fam-3'];

// Bloquant — séquentiel de fait : fam-1 bloque, puis fam-2, puis fam-3
// Durée totale ≈ T1 + T2 + T3
const résultats = ids.map(id => getMembresBloquant(id));

// Non-bloquant — les 3 lectures partent simultanément vers le thread pool libuv
// Durée totale ≈ max(T1, T2, T3)
const résultats = await Promise.all(ids.map(id => getMembresAsync(id)));
```

Pas-à-pas de la version non-bloquante :

1. `Promise.all` démarre les 3 appels `getMembresAsync` — chacun atteint `readFile` et délègue au thread pool libuv.
2. Le thread principal est libéré immédiatement après le 3e `readFile`. L'event loop peut traiter d'autres requêtes HTTP.
3. Quand la première lecture termine, libuv place son callback dans la poll queue.
4. L'event loop (phase poll) exécute le callback → `JSON.parse` → la Promise se résout.
5. `Promise.all` attend les 3 résolutions. La durée totale est dictée par la lecture la plus lente, pas par leur somme.

## 4. Pièges & misconceptions

**`setTimeout(fn, 0)` ≠ exécution immédiate.** `setTimeout(fn, 0)` enregistre un timer avec un délai minimal de 1 ms (ou plus selon la charge système). Il s'exécute dans la phase *timers* — après la nextTick queue et la microtask queue. Des centaines de `.then` peuvent s'intercaler avant ce "0ms". *Correct* : pour différer après les microtasks courantes, `setImmediate` (check phase) ; pour ajouter à la microtask queue, `queueMicrotask`.

**`process.nextTick` récursif affame l'event loop.** Si un callback nextTick rappelle `process.nextTick`, la nextTick queue ne se vide jamais — aucune Promise, aucun I/O, aucun timer ne peut avancer.

```ts
// ❌ DANGER — event loop starvée indefiniment
function recurse(): void {
  process.nextTick(recurse); // boucle infinie dans la nextTick queue
}
recurse();

// ✅ Pour une récursion async sans bloquer, utiliser setImmediate
function recurse(): void {
  setImmediate(recurse); // passe par la check phase — laisse la place aux I/O et timers
}
```

**`fs.readFileSync` dans un handler HTTP bloque toutes les requêtes.** Un seul thread principal : si `readFileSync` prend 20 ms sur un fichier, toutes les requêtes simultanées attendent ces 20 ms. Avec 100 req/s et 20 ms de lecture, l'API est saturée à 50 req/s maximum. *Correct* : `fs.promises.readFile` ou `util.promisify(fs.readFile)` dans un handler `async`.

**L'ordre setImmediate / setTimeout(fn, 0) hors I/O n'est pas garanti.** Dans le scope global, l'ordre dépend du timing système (le timer a-t-il expiré avant que la phase timers ne démarre ?). À l'intérieur d'un callback I/O, l'event loop est déjà dans la phase poll quand les deux sont enregistrés — la phase check (setImmediate) précède la prochaine phase timers, donc `setImmediate` précède toujours `setTimeout(fn, 0)` dans ce contexte.

```ts
import { readFile } from 'node:fs';

readFile(__filename, () => {
  // Dans un callback I/O : ordre GARANTI
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
  // Sortie toujours : immediate → timeout
});
```

**`async/await` ne rend pas le code multi-thread.** `await` *suspend* la fonction courante et libère le thread principal, mais un seul callback JavaScript s'exécute à la fois. `await Promise.all([...])` lance plusieurs I/O en parallèle *dans libuv / l'OS*, mais leurs callbacks JS sont toujours sérialisés sur le thread principal.

## 5. Ancrage TribuZen

Couche fil-rouge : **asynchrone de l'API TribuZen** — chaque requête famille déclenche des I/O (lecture cache, requête DB, appel service notification). L'event loop est le garant que 1000 familles peuvent être servies simultanément par un seul processus Node.js.

```ts
// apps/api/src/famille/famille.service.ts
import { readFile } from 'node:fs/promises';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FamilleService {
  // async/await : thread libéré pendant chaque readFile
  // libuv exécute la lecture dans le thread pool
  async getMembres(id: string): Promise<Membre[]> {
    const raw = await readFile(`./cache/${id}.json`, 'utf-8');
    return JSON.parse(raw) as Membre[];
  }

  // Promise.all : profils ET droits lus simultanément — durée ≈ max(T_profils, T_droits)
  async getFamilleComplete(id: string): Promise<FamilleComplete> {
    const [membres, droits] = await Promise.all([
      this.getMembres(id),
      this.droitsService.getDroits(id),
    ]);
    return { membres, droits };
  }
}
```

Dès qu'un `readFileSync` ou un `scryptSync` s'glisse dans un handler NestJS, il bloque l'event loop pour toutes les requêtes en cours. Le principe s'applique identiquement aux requêtes TypeORM / PostgreSQL (module 04) : les drivers async délèguent les I/O réseau à libuv.

## 6. Points clés

1. Node.js est **mono-thread** : un seul call stack JS tourne à la fois. La concurrence vient de l'event loop + libuv, pas de threads JS parallèles.
2. L'event loop a **6 phases** dans l'ordre : timers → pending callbacks → idle/prepare → poll → check (setImmediate) → close callbacks.
3. **Entre chaque phase** : nextTick queue drainée en premier (priorité 1), puis microtask queue (Promise.then, queueMicrotask — priorité 2).
4. Ordre d'exécution complet : synchrone → nextTick → Promise microtasks → timers → I/O poll → setImmediate → close callbacks.
5. **`setImmediate` précède `setTimeout(fn, 0)` dans un callback I/O** ; dans le scope global, l'ordre dépend du timing système et n'est pas garanti.
6. **`process.nextTick` récursif affame l'event loop** — toujours préférer `setImmediate` pour les récursions async.
7. **Non-blocking I/O** : `fs.promises`, `node:net`, `node:http` délèguent à libuv et libèrent le thread. Les variantes `*Sync` le bloquent jusqu'au retour.
8. Le **thread pool libuv** (4 workers par défaut, configurable via `UV_THREADPOOL_SIZE`) gère les I/O qui ne peuvent pas être async au niveau OS.

## 7. Seeds Anki

```
Quelles sont les 6 phases de l'event loop Node.js dans l'ordre ?|timers → pending callbacks → idle/prepare → poll → check (setImmediate) → close callbacks
Quel est l'ordre exact entre nextTick, Promise.then et setTimeout(fn,0) ?|synchrone → nextTick queue (tout, récursivement) → microtask queue (Promise.then) → phase timers (setTimeout)
Pourquoi process.nextTick récursif bloque l'event loop ?|La nextTick queue est drainée entièrement avant toute phase. Un nextTick qui ré-enregistre un nextTick crée une boucle infinie — aucune I/O ni Promise ne peut avancer.
Quelle est la différence entre setImmediate et setTimeout(fn,0) dans un callback I/O ?|Dans un callback I/O, setImmediate précède toujours setTimeout(fn,0) — la check phase vient avant la prochaine phase timers. Dans le scope global, l'ordre n'est pas garanti.
Pourquoi fs.readFileSync bloque-t-il toutes les requêtes HTTP simultanées ?|Node.js est mono-thread. readFileSync occupe le call stack pendant toute la durée de la lecture — l'event loop ne peut rien traiter d'autre pendant ce temps.
Qu'est-ce que le thread pool libuv et quelle est sa taille par défaut ?|4 threads workers pour les opérations qui ne peuvent pas être async OS (fs.readFile, dns.lookup, crypto pbkdf2). Configurable via UV_THREADPOOL_SIZE avant tout import.
Comment Promise.all accélère plusieurs I/O non-bloquantes ?|Promise.all déclenche toutes les opérations I/O simultanément via libuv. Durée totale ≈ max(T1…Tn) au lieu de T1+T2+…+Tn. Le thread JS reste libre pendant l'attente.
Quelle est la différence de priorité entre process.nextTick et queueMicrotask ?|process.nextTick a la priorité la plus haute — sa queue est drainée entièrement avant la microtask queue. queueMicrotask ajoute à la microtask queue (même niveau que Promise.then).
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-01-event-loop/README.md`. Tu y écris de zéro un script Node.js 22 qui prédit et vérifie l'ordre d'exécution, puis convertis le handler TribuZen bloquant en non-bloquant avec mesure de la différence via `Promise.all`. Corrigé complet commenté + variante J+30 dans le README.
