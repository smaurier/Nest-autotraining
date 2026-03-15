# Module 02 — Node.js — Modules, FS & Process

> **Objectif** : Maîtriser le système de modules de Node.js (CommonJS et ESM), manipuler le système de fichiers (fs), comprendre l'objet process et gérer les dépendances avec npm.
>
> **Difficulte** : ⭐ (débutant)

---

## 1. Les systèmes de modules en Node.js

### 1.1 Pourquoi les modules existent

En JavaScript navigateur, tout code charge partage un scope global unique. Cela cause des collisions de noms, des dépendances implicites et une maintenance cauchemardesque. Les modules resolvent ce problème en isolant chaque fichier dans son propre scope.

> **Analogie** : Sans modules, ton code c'est comme un open space ou tout le monde crie en même temps — impossible de savoir qui parle a qui. Avec les modules, chaque fichier est un bureau ferme avec une porte (les exports) et une sonnette (les imports). Chacun travaille tranquillement et communique via des interfaces claires.

### 1.2 CommonJS (CJS) — Le système originel

CommonJS est le système de modules historique de Node.js. Il utilise `require()` et `module.exports` :

```typescript
// math.js — Exporter des fonctions
function additionner(a, b) {
  return a + b;
}

function multiplier(a, b) {
  return a * b;
}

// Export nomme (objet avec plusieurs valeurs)
module.exports = { additionner, multiplier };

// Alternative : exports raccourci
// exports.additionner = additionner;
// exports.multiplier = multiplier;
```

```typescript
// main.js — Importer des fonctions
const { additionner, multiplier } = require('./math');

console.log(additionner(2, 3));  // 5
console.log(multiplier(4, 5));   // 20

// Ou importer tout le module
const math = require('./math');
console.log(math.additionner(2, 3));
```

### 1.3 ESM (ECMAScript Modules) — Le standard moderne

ESM est le système de modules standard du langage JavaScript. Il utilise `import` et `export` :

```typescript
// math.mjs (ou .js avec "type": "module" dans package.json)

// Export nomme
export function additionner(a, b) {
  return a + b;
}

export function multiplier(a, b) {
  return a * b;
}

// Export par defaut (un seul par fichier)
export default class Calculator {
  add(a, b) { return a + b; }
  mul(a, b) { return a * b; }
}
```

```typescript
// main.mjs
import Calculator, { additionner, multiplier } from './math.mjs';

console.log(additionner(2, 3));  // 5
console.log(multiplier(4, 5));   // 20

const calc = new Calculator();
console.log(calc.add(2, 3));     // 5
```

### 1.4 Activer ESM dans un projet

Il y a deux facons d'utiliser ESM en Node.js :

**Option 1** : Extension `.mjs` pour les fichiers ESM

```bash
node mon-fichier.mjs
```

**Option 2** : Ajouter `"type": "module"` dans `package.json` (recommande)

```json
{
  "name": "mon-projet",
  "type": "module",
  "version": "1.0.0"
}
```

Avec cette option, tous les fichiers `.js` du projet sont traites comme ESM. Si tu as besoin d'un fichier CommonJS, utilise l'extension `.cjs`.

### 1.5 Comparaison CJS vs ESM

| Aspect | CommonJS (CJS) | ESM |
|---|---|---|
| **Syntaxe import** | `require('./module')` | `import { x } from './module.js'` |
| **Syntaxe export** | `module.exports = { x }` | `export { x }` ou `export default x` |
| **Chargement** | Synchrone | Asynchrone (statiquement analysable) |
| **Top-level await** | Non | Oui |
| **Extension** | `.js` (defaut) ou `.cjs` | `.mjs` ou `.js` avec `"type": "module"` |
| **`__dirname`** | Disponible | Non disponible (voir section 4) |
| **Interoperabilite** | Peut require() du CJS uniquement | Peut importer CJS et ESM |
| **Tree-shaking** | Non (imports dynamiques) | Oui (imports statiques) |
| **Utilisation** | Projets legacy, scripts simples | Projets modernes, recommande |

> **Bonne pratique** : Pour un nouveau projet, utilise ESM (`"type": "module"` dans package.json). C'est le standard JavaScript et c'est l'avenir. NestJS utilise aussi ESM (via TypeScript). Cependant, tu rencontreras encore beaucoup de code CommonJS dans des projets existants.

### 1.6 L'algorithme de résolution des modules

Quand tu fais `require('express')` ou `import express from 'express'`, Node.js cherche le module dans cet ordre :

```
1. Modules natifs (built-in)
   require('fs')      → Module natif, chargement immediat
   require('http')    → Module natif, chargement immediat

2. Chemin relatif/absolu (fichier local)
   require('./math')  → Cherche :
     a) ./math.js
     b) ./math.json
     c) ./math.node
     d) ./math/index.js
     e) ./math/package.json → champ "main"

3. Module tiers (node_modules)
   require('express') → Cherche dans :
     a) ./node_modules/express/
     b) ../node_modules/express/
     c) ../../node_modules/express/
     d) ... remonte jusqu'a la racine
```

> **Piege classique** : En ESM, tu DOIS inclure l'extension du fichier : `import { x } from './math.js'` (pas `'./math'`). En CJS, l'extension est optionnelle. C'est une source frequente d'erreurs quand tu migres de CJS vers ESM.

---

## 2. Le module path

Le module `path` permet de manipuler les chemins de fichiers de manière cross-platform (Windows utilise `\`, Linux/Mac utilise `/`).

```typescript
import path from 'path';
// ou en CJS : const path = require('path');

// path.join — Concatener des segments de chemin
path.join('dossier', 'sous-dossier', 'fichier.txt');
// Linux : 'dossier/sous-dossier/fichier.txt'
// Windows : 'dossier\\sous-dossier\\fichier.txt'

// path.resolve — Obtenir un chemin absolu
path.resolve('dossier', 'fichier.txt');
// '/home/user/projet/dossier/fichier.txt' (chemin absolu complet)

// path.dirname — Obtenir le repertoire parent
path.dirname('/home/user/projet/fichier.txt');
// '/home/user/projet'

// path.basename — Obtenir le nom du fichier
path.basename('/home/user/projet/fichier.txt');
// 'fichier.txt'

path.basename('/home/user/projet/fichier.txt', '.txt');
// 'fichier' (sans l'extension)

// path.extname — Obtenir l'extension
path.extname('photo.jpg');
// '.jpg'

path.extname('archive.tar.gz');
// '.gz' (seulement la derniere extension)

// path.parse — Decomposer un chemin
path.parse('/home/user/fichier.txt');
// {
//   root: '/',
//   dir: '/home/user',
//   base: 'fichier.txt',
//   ext: '.txt',
//   name: 'fichier'
// }

// path.format — Reconstruire un chemin a partir d'un objet
path.format({ dir: '/home/user', base: 'fichier.txt' });
// '/home/user/fichier.txt'

// path.isAbsolute — Verifier si un chemin est absolu
path.isAbsolute('/home/user');  // true
path.isAbsolute('./fichier');   // false

// path.relative — Chemin relatif entre deux chemins
path.relative('/home/user/projet', '/home/user/autre');
// '../autre'

// path.sep — Separateur de chemin (specifique a l'OS)
path.sep; // '/' sur Linux/Mac, '\\' sur Windows

// path.normalize — Nettoyer un chemin
path.normalize('/home//user/../user/./projet');
// '/home/user/projet'
```

> **Bonne pratique** : Utilise TOUJOURS `path.join()` ou `path.resolve()` pour construire des chemins. Ne concatene JAMAIS des chemins avec `+` ou des template literals — ça ne marchera pas sur tous les OS.

```typescript
// MAUVAIS — ne fonctionne pas sur Windows
const filePath = __dirname + '/data/' + filename;

// BON — fonctionne partout
const filePath = path.join(__dirname, 'data', filename);
```

---

## 3. Le module fs (File System)

### 3.1 Les trois API de fs

Node.js fournit **trois API** différentes pour manipuler les fichiers :

| API | Syntaxe | Quand l'utiliser |
|---|---|---|
| **Synchrone** | `fs.readFileSync()` | Scripts, initialisation, configuration |
| **Callback** | `fs.readFile(path, callback)` | Code legacy, compatibilite |
| **Promises** | `fs.promises.readFile()` ou `import { readFile } from 'fs/promises'` | **Recommande** — code moderne async/await |

```typescript
import fs from 'fs';
import { readFile, writeFile } from 'fs/promises';

// === API Synchrone ===
// Bloque le thread — a eviter dans un serveur
const data1 = fs.readFileSync('fichier.txt', 'utf-8');
console.log(data1);

// === API Callback ===
// Non-bloquant mais syntaxe verbeuse
fs.readFile('fichier.txt', 'utf-8', (err, data2) => {
  if (err) throw err;
  console.log(data2);
});

// === API Promises (recommande) ===
// Non-bloquant, syntaxe propre avec async/await
async function lire() {
  const data3 = await readFile('fichier.txt', 'utf-8');
  console.log(data3);
}
lire();
```

> **Piege classique** : N'utilise JAMAIS les méthodes synchrones (`readFileSync`, `writeFileSync`, etc.) dans un serveur HTTP. Elles bloquent le thread unique de Node.js — pendant la lecture, AUCUNE autre requête ne peut etre traitee. Les API sync ne sont acceptables que dans des scripts de démarrage ou des outils CLI.

### 3.2 Lire des fichiers

```typescript
import { readFile, readdir, stat } from 'fs/promises';
import path from 'path';

// Lire un fichier texte
async function lireFichier() {
  try {
    const contenu = await readFile('data.txt', 'utf-8');
    console.log(contenu);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error('Fichier introuvable');
    } else {
      throw err;
    }
  }
}

// Lire un fichier JSON
async function lireConfig() {
  const raw = await readFile('config.json', 'utf-8');
  const config = JSON.parse(raw);
  console.log(config.database.host);
}

// Lire un fichier binaire (image, PDF...)
async function lireImage() {
  const buffer = await readFile('photo.jpg'); // Pas de 'utf-8' → retourne un Buffer
  console.log(`Taille : ${buffer.length} octets`);
}

// Lister le contenu d'un dossier
async function listerDossier(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      console.log(`[DOSSIER] ${entry.name}`);
    } else if (entry.isFile()) {
      const stats = await stat(fullPath);
      console.log(`[FICHIER] ${entry.name} (${stats.size} octets)`);
    }
  }
}

listerDossier('.');
```

### 3.3 Écrire des fichiers

```typescript
import { writeFile, appendFile, copyFile, rename } from 'fs/promises';

// Ecrire un fichier (cree ou ecrase)
async function ecrire() {
  await writeFile('sortie.txt', 'Bonjour le monde !\n', 'utf-8');
  console.log('Fichier ecrit');
}

// Ajouter du contenu a la fin (append)
async function ajouter() {
  await appendFile('log.txt', `[${new Date().toISOString()}] Evenement\n`, 'utf-8');
  console.log('Ligne ajoutee');
}

// Ecrire du JSON
async function ecrireJSON() {
  const data = {
    users: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ],
  };
  await writeFile('users.json', JSON.stringify(data, null, 2), 'utf-8');
  console.log('JSON ecrit');
}

// Copier un fichier
async function copier() {
  await copyFile('original.txt', 'copie.txt');
  console.log('Fichier copie');
}

// Renommer / deplacer un fichier
async function deplacer() {
  await rename('ancien-nom.txt', 'nouveau-nom.txt');
  console.log('Fichier renomme');
}
```

### 3.4 Créer et supprimer des dossiers

```typescript
import { mkdir, rmdir, rm, access, constants } from 'fs/promises';

// Creer un dossier
async function creerDossier() {
  await mkdir('nouveau-dossier');
  console.log('Dossier cree');
}

// Creer des dossiers imbriques (recursive)
async function creerArborescence() {
  await mkdir('a/b/c/d', { recursive: true });
  console.log('Arborescence creee');
}

// Supprimer un dossier vide
async function supprimerDossierVide() {
  await rmdir('dossier-vide');
}

// Supprimer un dossier et tout son contenu (recursive)
async function supprimerTout() {
  await rm('dossier-a-supprimer', { recursive: true, force: true });
  console.log('Dossier supprime');
}

// Verifier si un fichier/dossier existe
async function existe(chemin) {
  try {
    await access(chemin, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Utilisation
if (await existe('config.json')) {
  console.log('Le fichier config.json existe');
} else {
  console.log('Le fichier config.json n\'existe pas');
}
```

### 3.5 Codes d'erreur fs courants

| Code | Signification | Cause typique |
|---|---|---|
| `ENOENT` | No such file or directory | Fichier ou dossier introuvable |
| `EACCES` | Permission denied | Pas les droits de lecture/écriture |
| `EEXIST` | File already exists | Le fichier/dossier existe déjà |
| `EISDIR` | Is a directory | Tu essaies de lire un dossier comme un fichier |
| `ENOTDIR` | Not a directory | Tu essaies de lister un fichier comme un dossier |
| `EMFILE` | Too many open files | Trop de fichiers ouverts simultanement |
| `ENOSPC` | No space left on device | Disque plein |

```typescript
import { readFile } from 'fs/promises';

try {
  await readFile('inexistant.txt', 'utf-8');
} catch (err) {
  switch (err.code) {
    case 'ENOENT':
      console.error('Fichier introuvable');
      break;
    case 'EACCES':
      console.error('Permission refusee');
      break;
    default:
      console.error('Erreur inconnue :', err.message);
  }
}
```

---

## 4. __dirname et import.meta.url

### 4.1 En CommonJS

```typescript
// En CJS, __dirname et __filename sont disponibles directement
console.log(__dirname);   // '/home/user/projet'
console.log(__filename);  // '/home/user/projet/main.js'

const path = require('path');
const configPath = path.join(__dirname, 'config.json');
```

### 4.2 En ESM — Le remplacement

En ESM, `__dirname` et `__filename` n'existent pas. Il faut utiliser `import.meta.url` :

```typescript
import { fileURLToPath } from 'url';
import path from 'path';

// Equivalent de __filename
const __filename = fileURLToPath(import.meta.url);

// Equivalent de __dirname
const __dirname = path.dirname(__filename);

console.log(__dirname);   // '/home/user/projet'
console.log(__filename);  // '/home/user/projet/main.js'

// Utilisation pour lire un fichier relatif
import { readFile } from 'fs/promises';
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(await readFile(configPath, 'utf-8'));
```

> **Bonne pratique** : Ce pattern `fileURLToPath(import.meta.url)` est tellement courant en ESM que tu devrais le mettre dans un snippet de ton editeur. Tu le retrouveras dans presque tous les fichiers qui ont besoin de charger des ressources relatives.

---

## 5. L'objet process

### 5.1 Qu'est-ce que process

`process` est un objet global de Node.js qui represente le processus en cours d'exécution. Il donne acces a l'environnement système, aux arguments, aux flux standard et au cycle de vie du processus.

### 5.2 process.env — Variables d'environnement

```typescript
// Lire les variables d'environnement
console.log(process.env.NODE_ENV);  // 'development' ou 'production'
console.log(process.env.PORT);      // '3000' (toujours une string !)
console.log(process.env.HOME);      // '/home/user'
console.log(process.env.PATH);      // Chemin systeme

// Definir des variables d'environnement
// Option 1 : en ligne de commande
// PORT=3000 NODE_ENV=production node server.js

// Option 2 : dans le code (deconseille)
process.env.MY_VAR = 'valeur';

// Option 3 : fichier .env avec la librairie dotenv (recommande)
// npm install dotenv
```

```typescript
// Fichier .env (a la racine du projet)
// PORT=3000
// DATABASE_URL=postgres://user:pass@localhost:5432/mydb
// JWT_SECRET=mon-secret-ultra-long

// Dans ton code (en haut du fichier principal)
import 'dotenv/config';
// ou : import dotenv from 'dotenv'; dotenv.config();

const port = parseInt(process.env.PORT, 10) || 3000;
const dbUrl = process.env.DATABASE_URL;
```

> **Piege classique** : Les valeurs de `process.env` sont TOUJOURS des **strings**. `process.env.PORT` vaut `'3000'` (string), pas `3000` (number). Pense a convertir avec `parseInt()` ou `Number()`. Et n'oublie pas de mettre `.env` dans ton `.gitignore` !

### 5.3 process.argv — Arguments de la ligne de commande

```typescript
// node script.js hello world --verbose
console.log(process.argv);
// [
//   '/usr/local/bin/node',        // argv[0] : chemin vers node
//   '/home/user/script.js',       // argv[1] : chemin vers le script
//   'hello',                       // argv[2] : premier argument
//   'world',                       // argv[3] : deuxieme argument
//   '--verbose'                    // argv[4] : flag
// ]

// Recuperer les arguments utiles (on ignore les 2 premiers)
const args = process.argv.slice(2);
console.log(args); // ['hello', 'world', '--verbose']
```

```typescript
// Exemple : script CLI simple
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'greet':
    const name = args[1] || 'World';
    console.log(`Hello, ${name}!`);
    break;
  case 'add':
    const a = parseFloat(args[1]);
    const b = parseFloat(args[2]);
    console.log(`${a} + ${b} = ${a + b}`);
    break;
  default:
    console.log('Commandes disponibles : greet, add');
}

// Utilisation :
// node script.js greet Alice     → Hello, Alice!
// node script.js add 2 3         → 2 + 3 = 5
```

### 5.4 process.exit — Arreter le processus

```typescript
// Quitter avec succes (code 0)
process.exit(0);

// Quitter avec erreur (code non-zero)
process.exit(1);

// Ecouter l'evenement exit (pour du nettoyage)
process.on('exit', (code) => {
  console.log(`Processus termine avec le code ${code}`);
  // ATTENTION : seules des operations SYNCHRONES fonctionnent ici
  // pas d'async, pas de setTimeout, pas de I/O
});

// Ecouter le signal SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('Ctrl+C detecte, arret propre...');
  // Nettoyage (fermer les connexions DB, sauvegarder l'etat, etc.)
  process.exit(0);
});

// Ecouter le signal SIGTERM (arret demande par le systeme/Docker)
process.on('SIGTERM', () => {
  console.log('SIGTERM recu, arret propre...');
  process.exit(0);
});
```

### 5.5 process.cwd() et process.chdir()

```typescript
// Repertoire de travail courant
console.log(process.cwd()); // '/home/user/projet'

// Changer le repertoire de travail (rarement necessaire)
process.chdir('/tmp');
console.log(process.cwd()); // '/tmp'
```

> **A retenir** : `process.cwd()` retourne le répertoire depuis lequel tu as lance `node`. `__dirname` retourne le répertoire du fichier source. Ce n'est pas la même chose si tu lances `node src/main.js` depuis le dossier parent.

### 5.6 process.stdin et process.stdout

```typescript
// Ecrire sur la sortie standard
process.stdout.write('Pas de saut de ligne a la fin');
// Equivalent de console.log mais sans le \n automatique

// Lire depuis l'entree standard
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (input) => {
  const text = input.trim();
  console.log(`Tu as tape : ${text}`);
  if (text === 'quit') process.exit(0);
});

console.log('Tape quelque chose (ou "quit" pour quitter) :');
```

### 5.7 Informations utiles de process

```typescript
// Version de Node.js
console.log(process.version);    // 'v20.11.0'
console.log(process.versions);   // { v8: '...', uv: '...', ... }

// Plateforme et architecture
console.log(process.platform);   // 'linux', 'darwin', 'win32'
console.log(process.arch);       // 'x64', 'arm64'

// PID du processus
console.log(process.pid);        // 12345

// Memoire utilisee
console.log(process.memoryUsage());
// {
//   rss: 40960000,        // Resident Set Size (total)
//   heapTotal: 10485760,  // Heap V8 total
//   heapUsed: 5242880,    // Heap V8 utilise
//   external: 1048576,    // Memoire C++ liee aux objets JS
//   arrayBuffers: 524288  // ArrayBuffers
// }

// Temps de fonctionnement du processus (en secondes)
console.log(process.uptime());   // 12.345
```

---

## 6. Le module os

```typescript
import os from 'os';

// Informations systeme
console.log(os.hostname());      // 'mon-pc'
console.log(os.type());          // 'Linux', 'Darwin', 'Windows_NT'
console.log(os.release());       // '5.15.0-91-generic'
console.log(os.platform());      // 'linux', 'darwin', 'win32'
console.log(os.arch());          // 'x64', 'arm64'

// CPU
console.log(os.cpus().length);   // 8 (nombre de coeurs)
console.log(os.cpus()[0].model); // 'Intel(R) Core(TM) i7-...'

// Memoire
console.log(os.totalmem());      // 17179869184 (en octets)
console.log(os.freemem());       // 8589934592 (en octets)

// Repertoire utilisateur
console.log(os.homedir());       // '/home/user' ou 'C:\\Users\\user'
console.log(os.tmpdir());        // '/tmp' ou 'C:\\Users\\user\\AppData\\Local\\Temp'

// Fin de ligne (EOL) specifique a l'OS
console.log(os.EOL);             // '\n' sur Linux/Mac, '\r\n' sur Windows

// Interfaces reseau
const nets = os.networkInterfaces();
for (const [name, interfaces] of Object.entries(nets)) {
  for (const iface of interfaces) {
    if (iface.family === 'IPv4' && !iface.internal) {
      console.log(`${name}: ${iface.address}`);
    }
  }
}
```

---

## 7. npm en profondeur

### 7.1 Anatomie complete du package.json

```json
{
  "name": "mon-api",
  "version": "1.2.3",
  "description": "API REST de gestion d'utilisateurs",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "nodemon src/index.js",
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/",
    "format": "prettier --write src/"
  },
  "dependencies": {
    "express": "^4.18.2",
    "dotenv": "^16.3.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0",
    "jest": "^29.7.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "@types/express": "^4.17.21",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "keywords": ["api", "rest", "express"],
  "author": "Ton Nom <ton@email.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/user/mon-api"
  }
}
```

### 7.2 Versioning semantique (semver)

Le format est `MAJOR.MINOR.PATCH` :

| Partie | Quand incrementer | Exemple |
|---|---|---|
| **MAJOR** | Changement incompatible (breaking change) | `1.0.0` → `2.0.0` |
| **MINOR** | Nouvelle fonctionnalite retro-compatible | `1.0.0` → `1.1.0` |
| **PATCH** | Correction de bug retro-compatible | `1.0.0` → `1.0.1` |

Les prefixes dans package.json :

| Prefixe | Signification | Exemple | Versions acceptees |
|---|---|---|---|
| `^` (caret) | Compatible MINOR | `^4.18.2` | `>= 4.18.2` et `< 5.0.0` |
| `~` (tilde) | Compatible PATCH | `~4.18.2` | `>= 4.18.2` et `< 4.19.0` |
| Aucun | Version exacte | `4.18.2` | Exactement `4.18.2` |
| `*` | N'importe quelle version | `*` | Toutes |

> **Bonne pratique** : Le prefixe `^` (defaut de npm) est généralement un bon choix. Il permet les mises a jour mineures et de patch tout en protegeant contre les breaking changes. Utilise le `package-lock.json` pour verrouiller les versions exactes et avoir des builds reproductibles.

### 7.3 Le fichier package-lock.json

Le `package-lock.json` **verrouille** les versions exactes de toutes les dépendances (directes et transitives) :

```
package.json      → "express": "^4.18.2" (range)
package-lock.json → "express": "4.18.2"  (version exacte)
```

| Commande | Comportement |
|---|---|
| `npm install` | Installe selon le lock file (si present) |
| `npm update` | Met a jour dans les ranges du package.json |
| `npm install express@latest` | Installe la dernière version et met a jour le lock |

> **Piege classique** : NE SUPPRIME JAMAIS `package-lock.json` pour "résoudre un problème". Le lock file garantit que tous les développeurs et le CI ont les memes versions. Commite-le TOUJOURS dans Git.

### 7.4 Le dossier node_modules

```
mon-projet/
├── node_modules/           ← Toutes les dependances installees
│   ├── express/
│   ├── body-parser/        ← Dependance transitive d'express
│   ├── cookie/             ← Dependance transitive
│   └── ... (des centaines de dossiers)
├── package.json
└── package-lock.json
```

> **A retenir** : Ne commite JAMAIS `node_modules` dans Git. Ajoute-le a ton `.gitignore`. Le dossier peut contenir des dizaines de milliers de fichiers et peser des centaines de Mo. Chaque développeur fait `npm install` pour regenerer son `node_modules` à partir du `package-lock.json`.

### 7.5 Commandes npm utiles

```bash
# Initialiser un projet
npm init -y                     # Cree un package.json avec les valeurs par defaut

# Installer des dependances
npm install express             # Dependance de production
npm install -D nodemon          # Dependance de developpement (-D = --save-dev)
npm install -g typescript       # Installation globale

# Gerer les dependances
npm update                      # Met a jour selon les ranges du package.json
npm outdated                    # Liste les paquets obsoletes
npm uninstall express           # Desinstalle un paquet

# Executer des scripts
npm start                       # Lance le script "start"
npm run dev                     # Lance le script "dev"
npm test                        # Lance le script "test"

# Informations
npm list                        # Arbre des dependances installees
npm list --depth=0              # Seulement les dependances directes
npm info express                # Informations sur un paquet
npm audit                       # Verifier les vulnerabilites de securite
npm audit fix                   # Corriger automatiquement les vulnerabilites

# npx — Executer un paquet sans l'installer
npx create-react-app my-app
npx ts-node script.ts
```

---

## 8. Créer et structurer un module

### 8.1 Un module utilitaire

```typescript
// utils/string-utils.js

/**
 * Met en majuscule la premiere lettre d'une chaine
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Genere un slug a partir d'une chaine
 * @param {string} str
 * @returns {string}
 */
export function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Tronque une chaine a une longueur donnee
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(str, maxLength = 100) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
```

```typescript
// main.js — Utilisation
import { capitalize, slugify, truncate } from './utils/string-utils.js';

console.log(capitalize('bonjour'));          // 'Bonjour'
console.log(slugify('Mon Article de Blog')); // 'mon-article-de-blog'
console.log(truncate('Un texte tres long...', 10)); // 'Un text...'
```

### 8.2 Structure de projet recommandee

```
mon-projet/
├── src/
│   ├── index.js              ← Point d'entree
│   ├── config/
│   │   └── index.js          ← Configuration (env vars)
│   ├── utils/
│   │   ├── string-utils.js
│   │   └── date-utils.js
│   ├── services/
│   │   └── user-service.js
│   └── models/
│       └── user.js
├── tests/
│   └── string-utils.test.js
├── .env                       ← Variables d'environnement (PAS dans Git)
├── .env.example               ← Modele du .env (dans Git)
├── .gitignore
├── package.json
└── package-lock.json
```

---

## 9. Exercices pratiques

### Exercice 1 — Explorateur de fichiers

Ecris un script qui liste recursivement le contenu d'un dossier avec l'arborescence :

```typescript
// tree.js
import { readdir, stat } from 'fs/promises';
import path from 'path';

async function tree(dirPath, prefix = '') {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const fullPath = path.join(dirPath, entry.name);

    if (entry.name === 'node_modules' || entry.name === '.git') continue;

    const stats = await stat(fullPath);
    const size = entry.isFile() ? ` (${stats.size} o)` : '';
    console.log(`${prefix}${connector}${entry.name}${size}`);

    if (entry.isDirectory()) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      await tree(fullPath, newPrefix);
    }
  }
}

const targetDir = process.argv[2] || '.';
console.log(targetDir);
tree(targetDir);
```

### Exercice 2 — Gestionnaire de notes

Ecris un script CLI qui géré des notes stockees dans un fichier JSON :

```bash
node notes.js add "Ma premiere note"
node notes.js list
node notes.js delete 1
```

### Exercice 3 — Convertisseur de CSV en JSON

Ecris un script qui lit un fichier CSV et produit un fichier JSON :

```bash
node csv-to-json.js data.csv output.json
```

---

## 10. Résumé — Les concepts clés

| Concept | Definition |
|---|---|
| **CommonJS** | Système de modules avec `require`/`module.exports` |
| **ESM** | Système de modules standard avec `import`/`export` |
| **path** | Module pour manipuler les chemins de fichiers cross-platform |
| **fs/promises** | API asynchrone pour le système de fichiers |
| **process.env** | Variables d'environnement (toujours des strings) |
| **process.argv** | Arguments de la ligne de commande |
| **process.exit** | Arreter le processus avec un code de sortie |
| **npm** | Gestionnaire de paquets (install, update, audit) |
| **semver** | Versioning semantique (MAJOR.MINOR.PATCH) |
| **package-lock.json** | Verrouillage des versions exactes |

> **A retenir** : Les modules sont la brique de base de toute application Node.js. Utilise ESM pour les nouveaux projets, `path.join()` pour les chemins, `fs/promises` pour le système de fichiers et `process.env` pour la configuration. npm et package.json sont les outils indispensables pour gérer les dépendances.

---

## Navigation

| | Lien |
|---|---|
| Module précédent | [Module 01 — Node.js — Event Loop & Asynchrone](./01-nodejs-event-loop.md) |
| Module suivant | [Module 03 — Node.js — Streams & Buffers](./03-nodejs-streams-et-buffers.md) |
| Quiz | [Quiz Module 02](../quizzes/02-nodejs-modules-et-fs.quiz.md) |
| Lab | [Lab 02 — Modules et File System](../labs/02-nodejs-modules-et-fs.lab.md) |

---

> **A retenir** : Maîtriser les modules, le système de fichiers et l'objet process est fondamental pour tout projet Node.js. Ces API natives sont la base sur laquelle tous les frameworks (Express, NestJS) sont construits. Un développeur backend qui connait bien ces outils est capable de comprendre et debugger n'importe quelle application Node.js.

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 02 modules fs](../screencasts/screencast-02-modules-fs.md)
2. **Lab** : [lab-02-modules-fs](../labs/lab-02-modules-fs/README)
3. **Quiz** : [quiz 02 modules fs](../quizzes/quiz-02-modules-fs.html)
:::
