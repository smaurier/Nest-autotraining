---
titre: Node.js modules et fs
cours: 09-nestjs
notions: [CommonJS vs ESM, require et import, résolution de modules, module.exports et export, fs sync async et promises, module path, __dirname et import.meta.url]
outcomes: [choisir entre CommonJS et ESM, importer/exporter proprement, lire et écrire des fichiers avec fs (promises), manipuler des chemins avec path]
prerequis: [01-nodejs-event-loop]
next: 03-nodejs-streams-et-buffers
libs: [{ name: node, version: "22" }]
tribuzen: gérer les fichiers côté serveur TribuZen (lecture de config, écriture de logs)
last-reviewed: 2026-07
---

# Node.js modules et fs

> **Outcomes — tu sauras FAIRE :** choisir entre CommonJS et ESM, importer/exporter proprement, lire et écrire des fichiers avec `fs/promises`, manipuler des chemins avec `path`.
> **Difficulté :** :star::star:

## 1. Cas concret d'abord

Le service backend TribuZen doit, à chaque démarrage :

1. Lire `config/app.json` pour récupérer le port et l'URL de la base de données.
2. Écrire une ligne horodatée dans `logs/app.log`.

Un collègue a laissé ce code :

```ts
// bootstrap.js — AVANT correction
const fs = require('fs')
const config = JSON.parse(fs.readFileSync('config/app.json'))

// ... puis dans un handler :
fs.appendFileSync('logs/app.log', `[${Date.now()}] started\n`)
```

**Trois problèmes :**

1. `require()` est CommonJS — NestJS compile en ESM via TypeScript avec `import`/`export`.
2. `readFileSync` et `appendFileSync` bloquent le thread Node.js pendant l'I/O — aucune requête ne peut être traitée en attendant.
3. `'config/app.json'` est relatif au **répertoire de travail** (`process.cwd()`), pas au fichier source — le chemin change selon d'où `node` est lancé.

Ce module te donne les outils pour corriger ces trois points.

## 2. Théorie complète, concise

### 2.1 CommonJS vs ESM

Node.js supporte deux systèmes de modules. Ils coexistent dans des codebases réelles.

| Aspect | CommonJS (CJS) | ESM |
|---|---|---|
| Syntaxe import | `require('./module')` | `import { x } from './module.js'` |
| Syntaxe export | `module.exports = { x }` | `export { x }` ou `export default x` |
| Chargement | Synchrone | Statique, analysable à la compilation |
| Top-level await | Non | Oui |
| `__dirname` natif | Oui | Non (voir §2.7) |
| Tree-shaking | Non | Oui |
| Extension fichier | `.js` (défaut) ou `.cjs` | `.mjs` ou `.js` avec `"type": "module"` |

**Pour activer ESM :** ajouter `"type": "module"` dans `package.json`. Tous les fichiers `.js` du projet deviennent ESM. Un fichier CJS isolé doit alors prendre l'extension `.cjs`.

```json
{
  "name": "tribuzen-api",
  "type": "module"
}
```

> **NestJS et TypeScript :** le code source utilise la syntaxe ESM (`import`/`export`). TypeScript compile selon le champ `module` de `tsconfig.json` — `"module": "NodeNext"` produit du vrai ESM, `"module": "CommonJS"` produit du CJS malgré la syntaxe source ESM.

### 2.2 require et import — syntaxe complète

**CJS — exporter :**

```ts
// config-loader.js (CJS)
function loadConfig(path) { /* ... */ }
const VERSION = '1.0'

// Export objet (plusieurs valeurs)
module.exports = { loadConfig, VERSION }

// Raccourci — équivalent ligne par ligne
// exports.loadConfig = loadConfig
// exports.VERSION = VERSION
```

**CJS — importer :**

```ts
const { loadConfig } = require('./config-loader')

// Importer tout le module
const configLoader = require('./config-loader')
configLoader.loadConfig('./app.json')

// Module natif
const fs = require('node:fs/promises')
```

**ESM — exporter :**

```ts
// config-loader.ts (ESM)
export function loadConfig(path: string): Config { /* ... */ }
export const VERSION = '1.0'

// Export par défaut — un seul par fichier
export default class ConfigLoader { /* ... */ }
```

**ESM — importer :**

```ts
// Extension obligatoire en ESM pur (.js même pour .ts compilé)
import ConfigLoader, { loadConfig, VERSION } from './config-loader.js'

// Import de type — effacé à la compilation TypeScript
import type { Config } from './types.js'

// Module natif — préfixe node: recommandé en Node.js 22
import { readFile } from 'node:fs/promises'
import path from 'node:path'
```

### 2.3 Résolution de modules

Quand Node.js rencontre `require('express')` ou `import express from 'express'`, il suit cet ordre :

```
1. Modules natifs intégrés
   require('node:fs')  → chargé immédiatement, priorité absolue

2. Chemin relatif ou absolu (commence par ./ ../ /)
   require('./math')   → cherche, dans l'ordre :
     a) ./math.js
     b) ./math.json
     c) ./math.node
     d) ./math/index.js
     e) ./math/package.json → champ "main"

3. Module tiers (node_modules)
   require('express')  → remonte les dossiers depuis le fichier courant :
     ./node_modules/express/
     ../node_modules/express/
     ../../node_modules/express/
     ... jusqu'à la racine
```

**Différence critique CJS vs ESM pour les chemins locaux :**

- CJS : `require('./math')` — l'extension est optionnelle, Node cherche `.js`, `.json`, etc.
- ESM : `import x from './math.js'` — l'**extension est obligatoire** (sauf si un bundler ou TypeScript résout à ta place).

### 2.4 module.exports vs export — live bindings

CJS exporte une **copie de la valeur** au moment du `require()` :

```ts
// counter.js (CJS)
let count = 0
exports.increment = () => count++
exports.getCount = () => count
// module.exports est un objet ordinaire — snapshot à l'import
```

ESM exporte des **live bindings** — les modules importateurs voient la valeur actuelle :

```ts
// counter.ts (ESM)
export let count = 0
export function increment() { count++ }
// l'importateur lit la valeur en temps réel via la liaison
```

**Piège CJS fréquent — réassigner `exports` rompt le lien :**

```ts
// ❌ exports n'est plus lié à module.exports
exports = { foo: 'bar' }

// ✅ toujours modifier module.exports directement
module.exports = { foo: 'bar' }
// ou ajouter des propriétés sur exports sans le réassigner
exports.foo = 'bar'
```

### 2.5 fs — synchrone, callback et promises

Node.js propose **trois API** pour le même module `fs`. Seule `fs/promises` est recommandée dans un serveur.

```ts
import fs from 'node:fs'
import { readFile } from 'node:fs/promises'

// === Synchrone — bloque le thread ===
// Acceptable dans un script CLI ou une phase d'initialisation avant le démarrage du serveur
const raw = fs.readFileSync('config.json', 'utf-8')

// === Callback — non-bloquant mais syntaxe lourde ===
// Code legacy — éviter dans tout nouveau code
fs.readFile('config.json', 'utf-8', (err, data) => {
  if (err) throw err
  console.log(data)
})

// === fs/promises — non-bloquant, async/await ===
// Recommandé pour tout code moderne
const data = await readFile('config.json', 'utf-8')
```

**Opérations courantes avec `node:fs/promises` :**

```ts
import {
  readFile,
  writeFile,
  appendFile,
  mkdir,
  readdir,
  access,
  constants,
} from 'node:fs/promises'

// Lire un fichier texte (encoding → string)
const text = await readFile('data.txt', 'utf-8')

// Lire un fichier JSON
const config = JSON.parse(await readFile('config.json', 'utf-8'))

// Écrire (crée ou écrase)
await writeFile('out.txt', 'contenu', 'utf-8')

// Écrire du JSON formaté
await writeFile('config.json', JSON.stringify(config, null, 2), 'utf-8')

// Ajouter à la fin sans écraser
await appendFile('app.log', `[${new Date().toISOString()}] démarrage\n`, 'utf-8')

// Créer des dossiers imbriqués (sans error si existant)
await mkdir('logs/2026/07', { recursive: true })

// Lister un dossier — withFileTypes donne accès à entry.isFile() / isDirectory()
const entries = await readdir('.', { withFileTypes: true })
const fichiers = entries.filter(e => e.isFile()).map(e => e.name)

// Vérifier l'existence sans try/catch
try {
  await access('config.json', constants.F_OK)
  // fichier accessible
} catch {
  // fichier absent ou non accessible
}
```

**Codes d'erreur fs fréquents :**

| Code | Signification | Cause |
|---|---|---|
| `ENOENT` | No such file or directory | Fichier ou dossier introuvable |
| `EACCES` | Permission denied | Droits insuffisants |
| `EEXIST` | File already exists | `mkdir` sans `{ recursive: true }` sur un dossier existant |
| `EISDIR` | Is a directory | Tentative de `readFile` sur un dossier |

### 2.6 module path

`node:path` manipule les chemins de fichiers de façon **cross-platform** — Windows utilise `\`, Linux/Mac utilisent `/`. Ne jamais concaténer des chemins avec `+` ou des template strings.

```ts
import path from 'node:path'

// join — concatène des segments, normalise les séparateurs
path.join('config', 'app.json')           // 'config/app.json'
path.join('/srv', 'app', '../data')       // '/srv/data' (normalise ..)

// resolve — construit un chemin ABSOLU
// Si un segment est absolu, il repart de là. Sinon, part du CWD.
path.resolve('config', 'app.json')        // '/chemin/cwd/config/app.json'
path.resolve('/srv', 'config', 'app.json')// '/srv/config/app.json'

// dirname / basename / extname
path.dirname('/srv/app/config.json')      // '/srv/app'
path.basename('/srv/app/config.json')     // 'config.json'
path.basename('/srv/app/config.json', '.json') // 'config'
path.extname('app.config.ts')             // '.ts'

// parse — décompose un chemin en objet
path.parse('/srv/app/config.json')
// { root: '/', dir: '/srv/app', base: 'config.json', ext: '.json', name: 'config' }

// isAbsolute
path.isAbsolute('/srv/app')               // true
path.isAbsolute('./config')               // false

// sep — séparateur OS
path.sep                                  // '/' sur Linux/Mac, '\\' sur Windows
```

**`join` vs `resolve` — la règle :**

- `path.join('a', 'b', 'c')` → concatène des segments, résultat **relatif** si aucun segment absolu.
- `path.resolve('a', 'b')` → résultat toujours **absolu** (part du CWD si aucun segment absolu).

```ts
// ❌ concaténation manuelle — ne marche pas sur Windows
const p = __dirname + '/config/' + filename

// ✅ path.join — cross-platform
const p = path.join(__dirname, 'config', filename)
```

### 2.7 \_\_dirname et import.meta.url

**En CommonJS** — `__dirname` et `__filename` sont injectés par Node dans chaque module :

```ts
// bootstrap.js (CJS)
console.log(__dirname)   // '/srv/app/src'
console.log(__filename)  // '/srv/app/src/bootstrap.js'

const configPath = path.join(__dirname, '..', 'config', 'app.json')
```

**En ESM** — ces variables n'existent pas. On les reconstruit via `import.meta.url` :

```ts
// bootstrap.ts (ESM)
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
// import.meta.url = 'file:///srv/app/src/bootstrap.ts'
// __filename      = '/srv/app/src/bootstrap.ts'

const __dirname = path.dirname(__filename)
// __dirname = '/srv/app/src'

const configPath = path.join(__dirname, '..', 'config', 'app.json')
```

**Node.js 21.2+ — propriétés natives (Node 22 recommandé) :**

Depuis Node.js 21.2, `import.meta.dirname` et `import.meta.filename` sont disponibles nativement — plus besoin du polyfill `fileURLToPath` :

```ts
// Node.js 22 — natif, préférer cette forme
const dir  = import.meta.dirname   // '/srv/app/src'
const file = import.meta.filename  // '/srv/app/src/bootstrap.ts'

const configPath = path.join(import.meta.dirname, '..', 'config', 'app.json')
```

## 3. Worked examples

### Exemple A — Lire une config JSON avec un chemin absolu (ESM, Node.js 22)

```ts
// src/config/load-config.ts
import { readFile } from 'node:fs/promises'
import path from 'node:path'

interface AppConfig {
  port: number
  databaseUrl: string
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export async function loadConfig(): Promise<AppConfig> {
  // import.meta.dirname = répertoire absolu de CE fichier, quelle que soit
  // la commande utilisée pour lancer Node.js
  const configPath = path.join(import.meta.dirname, '..', '..', 'config', 'app.json')

  let raw: string
  try {
    raw = await readFile(configPath, 'utf-8')
  } catch (err) {
    // Typer l'erreur pour accéder à .code
    const fsErr = err as NodeJS.ErrnoException
    if (fsErr.code === 'ENOENT') {
      throw new Error(`Config manquante : ${configPath}`)
    }
    throw err
  }

  // JSON.parse lève SyntaxError si le fichier est malformé
  const config = JSON.parse(raw) as AppConfig

  // Validation minimale
  if (!config.databaseUrl) {
    throw new Error('Config invalide : databaseUrl manquant')
  }

  return config
}
```

**Pas-à-pas :**

1. `import.meta.dirname` donne le chemin absolu du fichier source — indépendant du CWD.
2. `path.join` remonte de deux niveaux (`src/config` → racine) puis descend dans `config/`.
3. Le `try/catch` discrimine `ENOENT` (fichier absent) des autres erreurs I/O.
4. `as NodeJS.ErrnoException` permet d'accéder à `.code` sans `any` — type fourni par `@types/node`.

### Exemple B — Écrire des logs avec appendFile + rotation simple

```ts
// src/logger/file-logger.ts
import { appendFile, mkdir, access, constants } from 'node:fs/promises'
import path from 'node:path'

const LOG_DIR = path.join(import.meta.dirname, '..', '..', 'logs')

// Assure que le dossier logs/ existe avant le premier appel
async function ensureLogDir(): Promise<void> {
  // mkdir avec recursive: true — idempotent, ne lève pas EEXIST
  await mkdir(LOG_DIR, { recursive: true })
}

let dirReady = false

export async function writeLog(
  level: 'info' | 'warn' | 'error',
  message: string,
): Promise<void> {
  if (!dirReady) {
    await ensureLogDir()
    dirReady = true
  }

  const logFile = path.join(LOG_DIR, 'app.log')
  const timestamp = new Date().toISOString()
  // Format JSON lines (ndjson) — facilite le parsing par des outils comme jq
  const line = JSON.stringify({ timestamp, level, message }) + '\n'

  await appendFile(logFile, line, 'utf-8')
}
```

**Utilisation :**

```ts
// src/main.ts
import { loadConfig } from './config/load-config.js'
import { writeLog } from './logger/file-logger.js'

const config = await loadConfig()
await writeLog('info', `TribuZen démarré sur le port ${config.port}`)
```

**Pas-à-pas :**

1. `LOG_DIR` est absolu via `import.meta.dirname` — le dossier est toujours au même endroit quel que soit le CWD.
2. `mkdir({ recursive: true })` est idempotent — pas d'erreur si `logs/` existe déjà.
3. Le flag `dirReady` évite d'appeler `ensureLogDir` à chaque log (optimisation minimale).
4. Format ndjson — chaque ligne est un JSON valide, facilement parseable en pipeline.

## 4. Pièges & misconceptions

**`require()` dans un fichier ESM → SyntaxError.**
`require` n'existe pas dans le scope d'un module ESM. Si le projet a `"type": "module"` dans `package.json` ou utilise `.mjs`, utiliser `import`. Si un fichier doit rester CJS, le renommer en `.cjs`.

**`readFileSync()` dans un gestionnaire HTTP → latence de toutes les requêtes.**
`readFileSync` bloque l'event loop pendant la lecture. Si le fichier met 50 ms à être lu, aucune autre requête n'est traitée pendant ces 50 ms. Seule exception acceptable : des scripts CLI ou la phase de démarrage *avant* que le serveur n'ouvre son port. Dans un NestJS `AppModule`, utiliser `fs/promises`.

**Extension omise en ESM → `ERR_MODULE_NOT_FOUND`.**
`import { foo } from './utils'` lève une erreur en ESM pur. Node.js ne tente pas `utils.js`. La correction : `'./utils.js'`. Avec TypeScript, le code source peut omettre `.ts` mais la sortie compilée doit référencer `.js` — utiliser `"moduleResolution": "NodeNext"` dans tsconfig pour que TypeScript le vérifie.

**`exports = { foo }` rompt le lien avec `module.exports`.**
Dans un module CJS, `exports` est un alias vers `module.exports`. Réassigner `exports` brise l'alias : l'importateur ne voit plus rien. Toujours modifier `module.exports` directement ou ajouter des propriétés sur `exports` sans le réassigner.

**Chemin relatif dans `readFile` = relatif au CWD, pas au fichier.**
`readFile('./config/app.json')` résout depuis `process.cwd()`, le dossier depuis lequel `node` a été lancé. Si le serveur est lancé depuis `/` au lieu de `/srv/app`, le chemin est invalide. Toujours construire un chemin absolu avec `import.meta.dirname` (ESM) ou `__dirname` (CJS) + `path.join`.

**`path.join` vs `path.resolve` — ne pas les confondre.**
`path.join('a', 'b')` retourne `'a/b'` (relatif si aucun segment absolu). `path.resolve('a', 'b')` retourne `/cwd/a/b` (toujours absolu). Pour construire un chemin depuis `__dirname`, les deux fonctionnent — `path.join(__dirname, 'config')` est idiomatique et suffisant.

## 5. Ancrage TribuZen

Couche fil-rouge : **gérer les fichiers côté serveur TribuZen (lecture de config, écriture de logs)**.

**`src/config/load-config.ts`** — lu au démarrage du service NestJS via `ConfigService`. Utilise `readFile` + `JSON.parse` avec un chemin absolu via `import.meta.dirname`. Permet de charger l'URL de la base PostgreSQL et les clés JWT sans dépendre de variables d'environnement codées en dur.

**`src/logger/file-logger.ts`** — horodate et appende chaque événement métier (invitation acceptée, famille créée, erreur webhook) dans `logs/app.log` en format ndjson. Le dossier `logs/` est créé au premier appel via `mkdir({ recursive: true })`.

**`src/scripts/export-users.ts`** — script CLI (lancé hors serveur) qui lit `users.json`, filtre, et écrit un CSV de rapport. Ici `readFileSync` est acceptable : c'est un script isolé, pas un serveur.

```
tribuzen/
  config/
    app.json          ← lu par load-config.ts (readFile)
  logs/
    app.log           ← écrit par file-logger.ts (appendFile)
  src/
    config/
      load-config.ts  ← Exemple A de ce module
    logger/
      file-logger.ts  ← Exemple B de ce module
    scripts/
      export-users.ts ← readFileSync acceptable (CLI)
```

## 6. Points clés

1. CJS = `require`/`module.exports`, chargement synchrone, `__dirname` natif — ESM = `import`/`export`, statique, tree-shakable, `import.meta.dirname` (Node 22).
2. Activer ESM : `"type": "module"` dans `package.json` ; un fichier CJS isolé prend l'extension `.cjs`.
3. En ESM, l'extension est **obligatoire** dans les imports locaux (`'./math.js'`).
4. `require()` dans un ESM → `SyntaxError` ; `import()` dynamique fonctionne des deux côtés.
5. `exports = { foo }` brise le lien avec `module.exports` — ne jamais réassigner `exports`.
6. `fs/promises` (ou `node:fs/promises`) : `readFile`, `writeFile`, `appendFile`, `mkdir`, `readdir` — toutes retournent des Promises.
7. `readFileSync` bloque l'event loop — acceptable uniquement dans des scripts CLI ou l'initialisation pré-serveur.
8. Toujours construire des chemins absolus avec `import.meta.dirname` (ESM, Node 22) ou `__dirname` (CJS) + `path.join` — jamais de chemin relatif dans `readFile`.
9. `path.join` = concaténation cross-platform ; `path.resolve` = résultat toujours absolu depuis CWD.
10. Préfixe `node:` sur les modules natifs (`'node:fs/promises'`) — recommandé en Node.js 22 pour éviter les collisions avec des packages npm.

## 7. Seeds Anki

```
Quelle est la différence principale entre CJS et ESM pour le chargement ?|CJS charge de façon synchrone (require bloque) ; ESM est statique et analysable à la compilation — permet le tree-shaking et le top-level await
Pourquoi readFileSync est-il interdit dans un serveur HTTP Node.js ?|Il bloque l'event loop : pendant la lecture, aucune autre requête n'est traitée. Utiliser fs/promises avec await qui libère le thread pendant l'I/O
Comment obtenir __dirname en ESM avec Node.js 22 ?|import.meta.dirname (natif depuis Node 21.2). Alternative polyfill : const __filename = fileURLToPath(import.meta.url) puis path.dirname(__filename)
Quel est le piège de exports = { foo } en CommonJS ?|Réassigner exports brise l'alias avec module.exports — l'importateur ne voit plus rien. Modifier module.exports directement ou ajouter des propriétés : exports.foo = foo
Pourquoi import x from './math' échoue-t-il en ESM pur ?|En ESM, l'extension du fichier est obligatoire. Node ne tente pas '.js' automatiquement. Correct : import x from './math.js'
Quelle différence entre path.join et path.resolve ?|path.join concatène des segments (résultat relatif si aucun segment absolu) ; path.resolve construit toujours un chemin absolu depuis le CWD (ou depuis le dernier segment absolu)
Quel préfixe recommande Node.js 22 pour les modules natifs et pourquoi ?|node: — ex. 'node:fs/promises'. Évite les collisions avec des packages npm portant le même nom et signale clairement que c'est un module intégré
Comment vérifier l'existence d'un fichier avec fs/promises sans lever d'exception ?|try { await access(path, constants.F_OK) } catch {} — access lève ENOENT si le fichier est absent, sinon réussit silencieusement
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-02-modules-fs/`. Tu y implémentes `loadConfig` et `writeLog` avec `node:fs/promises` et `node:path` sur un projet Node.js 22 minimal en ESM, avec corrigé intégral commenté et variante J+30.
