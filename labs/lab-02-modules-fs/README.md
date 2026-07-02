# Lab 02 — Node.js modules et fs

> **Outcome :** à la fin, tu sais lire une config JSON et écrire des logs avec `node:fs/promises` + `node:path` en ESM sur Node.js 22.
> **Vrai outil :** Node.js 22 natif — `node:fs/promises`, `node:path`, `import.meta.dirname`.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

TribuZen backend doit démarrer en chargeant sa configuration depuis `config/app.json` et en écrivant une ligne de log dans `logs/app.log`. Tu vas implémenter deux modules ESM et un point d'entrée qui les orchestre.

**Structure cible :**

```
lab-02-modules-fs/
  config/
    app.json          ← fourni
  logs/               ← à créer par ton code
    app.log           ← écrit par ton code
  src/
    load-config.ts    ← à implémenter
    write-log.ts      ← à implémenter
    main.ts           ← à implémenter
  package.json        ← fourni ("type": "module")
  tsconfig.json       ← fourni
```

**`config/app.json` (fourni) :**

```json
{
  "port": 3000,
  "databaseUrl": "postgres://tribuzen:secret@localhost:5432/tribuzen",
  "logLevel": "info"
}
```

## Étapes (en friction)

1. **Crée `src/load-config.ts`** — exporte une fonction `loadConfig(): Promise<AppConfig>` qui :
   - Lit `config/app.json` via `readFile` (pas `readFileSync`)
   - Construit le chemin avec `import.meta.dirname` et `path.join` (chemin absolu)
   - Lève une `Error` lisible si le fichier est absent (`ENOENT`) ou si `databaseUrl` est vide
   - Retourne l'objet parsé typé `AppConfig`

2. **Crée `src/write-log.ts`** — exporte une fonction `writeLog(level: LogLevel, message: string): Promise<void>` qui :
   - Crée `logs/` si absent (`mkdir` avec `recursive: true`)
   - Appende une ligne JSON (`{ timestamp, level, message }`) dans `logs/app.log`
   - Utilise un chemin absolu (même principe que `load-config.ts`)

3. **Crée `src/main.ts`** — point d'entrée qui :
   - Appelle `loadConfig()` et affiche le port avec `console.log`
   - Appelle `writeLog('info', 'TribuZen démarré')` après le chargement
   - Affiche `console.log('Log écrit.')` à la fin

4. **Lance avec :** `npx tsx src/main.ts` depuis `lab-02-modules-fs/`

   Résultat attendu en console :
   ```
   Port : 3000
   Log écrit.
   ```
   Et dans `logs/app.log` :
   ```
   {"timestamp":"2026-07-02T...","level":"info","message":"TribuZen démarré"}
   ```

5. **Valide manuellement** :
   - Supprime `config/app.json`, relance → message d'erreur clair (pas de stack trace brute)
   - Relance sans supprimer → le log est *ajouté* (append), pas écrasé

## Corrigé complet commenté

### `src/load-config.ts`

```ts
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export interface AppConfig {
  port: number
  databaseUrl: string
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export async function loadConfig(): Promise<AppConfig> {
  // import.meta.dirname = répertoire absolu de CE fichier (src/)
  // On remonte d'un niveau pour atteindre la racine du lab, puis config/app.json
  const configPath = path.join(import.meta.dirname, '..', 'config', 'app.json')

  let raw: string
  try {
    // readFile avec encoding 'utf-8' retourne une string
    // sans encoding, il retourne un Buffer binaire
    raw = await readFile(configPath, 'utf-8')
  } catch (err) {
    // NodeJS.ErrnoException étend Error avec un champ code
    const fsErr = err as NodeJS.ErrnoException
    if (fsErr.code === 'ENOENT') {
      // Message lisible — l'opérateur voit le chemin exact
      throw new Error(`[loadConfig] Fichier config introuvable : ${configPath}`)
    }
    // Toute autre erreur (EACCES, etc.) est reraisée telle quelle
    throw err
  }

  // JSON.parse lève SyntaxError si le JSON est malformé
  // Le cast 'as AppConfig' indique notre intention — pas de validation runtime ici
  const config = JSON.parse(raw) as AppConfig

  // Validation minimale : databaseUrl est indispensable au démarrage
  if (!config.databaseUrl) {
    throw new Error('[loadConfig] Config invalide : databaseUrl absent ou vide')
  }

  return config
}
```

### `src/write-log.ts`

```ts
import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// Chemin absolu du dossier logs/ — construit une seule fois au chargement du module
const LOG_DIR = path.join(import.meta.dirname, '..', 'logs')
const LOG_FILE = path.join(LOG_DIR, 'app.log')

// Flag module-level pour éviter un mkdir à chaque appel
// (le dossier ne disparaît pas entre deux appels en conditions normales)
let dirReady = false

async function ensureLogDir(): Promise<void> {
  // recursive: true — ne lève pas EEXIST si le dossier existe déjà
  // Crée aussi les dossiers parents manquants
  await mkdir(LOG_DIR, { recursive: true })
}

export async function writeLog(level: LogLevel, message: string): Promise<void> {
  if (!dirReady) {
    await ensureLogDir()
    dirReady = true
  }

  // ISO 8601 — format universel, facilement parseable
  const timestamp = new Date().toISOString()

  // Format ndjson (newline-delimited JSON) : une ligne = un JSON valide
  // Compatible avec des outils comme jq, Datadog, Loki
  const line = JSON.stringify({ timestamp, level, message }) + '\n'

  // appendFile ne tronque pas le fichier existant — différence clé avec writeFile
  await appendFile(LOG_FILE, line, 'utf-8')
}
```

### `src/main.ts`

```ts
// Extension .js obligatoire dans les imports ESM (même pour des fichiers .ts)
// TypeScript avec moduleResolution: NodeNext résout .js → .ts à la compilation
import { loadConfig } from './load-config.js'
import { writeLog } from './write-log.js'

// Top-level await — disponible en ESM (pas en CJS)
const config = await loadConfig()
console.log(`Port : ${config.port}`)

await writeLog('info', 'TribuZen démarré')
console.log('Log écrit.')
```

### `package.json` (rappel)

```json
{
  "name": "lab-02-modules-fs",
  "type": "module",
  "scripts": {
    "start": "npx tsx src/main.ts"
  }
}
```

**Notes sur le corrigé :**

- `import.meta.dirname` (Node.js 22 natif) remplace le polyfill `fileURLToPath(import.meta.url)` — plus concis, même résultat.
- Le flag `dirReady` est une micro-optimisation pédagogique : en production, on utiliserait un service initialisé une fois (`onModuleInit` dans NestJS).
- `as NodeJS.ErrnoException` est préférable à `any` : donne accès à `.code` typé sans perdre la vérification.
- Les imports locaux terminent en `.js` même pour des fichiers `.ts` — c'est la convention TypeScript ESM avec `moduleResolution: NodeNext`.

## Variante J+30 (fading)

Même problème, en 20 minutes, avec deux contraintes ajoutées :

1. `loadConfig` doit **fusionner** les valeurs de `config/app.json` avec les variables d'environnement (`process.env.PORT` surcharge `config.port` si défini).
2. `writeLog` doit **faire pivoter** le fichier log : si `logs/app.log` dépasse 1 Mo, renommer en `logs/app-YYYY-MM-DD.log` et créer un nouveau `logs/app.log` vide.

Indices autorisés : `stat` pour obtenir la taille, `rename` pour la rotation, `Number(process.env.PORT)` pour la surcharge.

## Application TribuZen

Dans `smaurier/tribuzen`, ces deux modules deviennent :

- `src/config/app-config.service.ts` — NestJS `@Injectable()` wrappant `loadConfig`, injecté dans `AppModule` via `ConfigModule`.
- `src/logger/file-logger.service.ts` — NestJS `@Injectable()` avec méthode `log(level, message)`, wrappant `writeLog`, utilisé par les guards et les interceptors pour tracer les appels API.

La logique fs/promises reste identique — NestJS ajoute juste le conteneur DI autour.

```
tribuzen/src/
  config/
    app-config.service.ts   ← loadConfig() wrappé en @Injectable
  logger/
    file-logger.service.ts  ← writeLog() wrappé en @Injectable
```
