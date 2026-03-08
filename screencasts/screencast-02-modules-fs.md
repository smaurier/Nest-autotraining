# Screencast 02 — Modules, FS & Process

## Informations
- **Duree estimee** : 12-15 min
- **Module** : `modules/02-nodejs-modules-et-fs.md`
- **Lab associe** : `labs/lab-02-modules-fs/`
- **Prerequis** : Screencast 01 (Event Loop & Asynchrone)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Editeur de code ouvert
- [ ] Dossier de travail vide pour les demos

## Script

### [00:00-02:30] Introduction — Organiser son code

> Salut ! Aujourd'hui on va parler de trois piliers fondamentaux de Node.js : le systeme de modules, le systeme de fichiers, et l'objet process. Ce sont les briques de base pour construire n'importe quelle application backend.

**Action** : Afficher le slide de titre "Module 02 — Modules, FS & Process".

> Quand votre code grandit, vous ne pouvez pas tout mettre dans un seul fichier. Il faut decouper, organiser, reutiliser. C'est le role du systeme de modules. Node.js en supporte deux : CommonJS et ES Modules.

### [02:30-06:00] CommonJS vs ES Modules

> CommonJS, c'est le systeme historique de Node.js. On exporte avec `module.exports` et on importe avec `require()`.

**Action** : Creer deux fichiers pour illustrer CommonJS.

```javascript
// math.js (CommonJS)
function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

module.exports = { add, multiply };
```

```javascript
// app.js (CommonJS)
const { add, multiply } = require('./math');

console.log(add(2, 3));       // 5
console.log(multiply(4, 5));  // 20
```

**Action** : Executer le script.

```bash
node app.js
```

> Ca marche. Maintenant, ES Modules. C'est le standard JavaScript moderne, avec `import` et `export`. Pour l'activer dans Node.js, on a deux options : renommer le fichier en `.mjs`, ou ajouter `"type": "module"` dans le `package.json`.

**Action** : Creer un projet avec ES Modules.

```bash
mkdir esm-demo && cd esm-demo
npm init -y
```

**Action** : Modifier le `package.json` et creer les fichiers.

```json
{
  "name": "esm-demo",
  "type": "module"
}
```

```javascript
// math.mjs
export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}
```

```javascript
// app.mjs
import { add, multiply } from './math.mjs';

console.log(add(2, 3));
console.log(multiply(4, 5));
```

> Dans cette formation, on utilisera ES Modules quand on passera a NestJS et TypeScript. Pour l'instant, CommonJS est parfaitement valable pour nos exemples Node.js purs.

### [06:00-09:00] Le module fs — Lire et ecrire des fichiers

> Le module `fs` (file system) permet de manipuler des fichiers. C'est un module built-in, pas besoin de l'installer.

**Action** : Creer un script de demonstration du module fs.

```javascript
// fs-demo.js
const fs = require('fs').promises;
const path = require('path');

async function main() {
  // Ecrire un fichier
  await fs.writeFile('notes.txt', 'Ma premiere note\n');
  console.log('Fichier cree !');

  // Lire un fichier
  const contenu = await fs.readFile('notes.txt', 'utf8');
  console.log('Contenu :', contenu);

  // Ajouter du contenu
  await fs.appendFile('notes.txt', 'Deuxieme ligne\n');

  // Lister un repertoire
  const fichiers = await fs.readdir('.');
  console.log('Fichiers :', fichiers);

  // Infos sur un fichier
  const stats = await fs.stat('notes.txt');
  console.log('Taille :', stats.size, 'octets');
  console.log('Cree le :', stats.birthtime);

  // Creer un dossier
  await fs.mkdir('backup', { recursive: true });

  // Copier un fichier
  await fs.copyFile('notes.txt', path.join('backup', 'notes-backup.txt'));
  console.log('Backup cree !');
}

main().catch(console.error);
```

**Action** : Executer et montrer les resultats.

```bash
node fs-demo.js
cat notes.txt
ls backup/
```

> On utilise la version `promises` du module fs pour travailler avec async/await. Notez le module `path` : il gere les chemins de fichiers de maniere portable entre Windows, Mac et Linux.

### [09:00-11:30] L'objet process — Le lien avec le systeme

> L'objet `process` est disponible partout dans Node.js. Il donne acces aux arguments de la ligne de commande, aux variables d'environnement, et permet de controler le processus.

**Action** : Creer un script qui utilise process.

```javascript
// process-demo.js
// Arguments de la ligne de commande
console.log('Arguments :', process.argv.slice(2));

// Variables d'environnement
console.log('NODE_ENV :', process.env.NODE_ENV || 'non defini');
console.log('HOME :', process.env.HOME || process.env.USERPROFILE);

// Informations sur le processus
console.log('PID :', process.pid);
console.log('Version Node :', process.version);
console.log('Repertoire :', process.cwd());

// Memoire utilisee
const mem = process.memoryUsage();
console.log('Memoire :', Math.round(mem.heapUsed / 1024 / 1024), 'MB');

// Quitter proprement
process.on('SIGINT', () => {
  console.log('\nArret propre...');
  process.exit(0);
});
```

**Action** : Executer avec des arguments et une variable d'environnement.

```bash
NODE_ENV=production node process-demo.js --port 3000 --verbose
```

> Les arguments sont dans `process.argv`, les variables d'environnement dans `process.env`. C'est comme ca qu'on configure une application en production : via les variables d'environnement, pas en codant en dur.

### [11:30-13:30] npm init et package.json

> Chaque projet Node.js commence par un `package.json`. C'est la carte d'identite du projet : nom, version, dependances, scripts.

**Action** : Initialiser un nouveau projet.

```bash
mkdir mon-projet && cd mon-projet
npm init -y
```

**Action** : Montrer le package.json genere et installer une dependance.

```bash
npm install chalk
```

```javascript
// index.js
const chalk = require('chalk');

console.log(chalk.green('Succes !'));
console.log(chalk.red.bold('Erreur critique'));
console.log(chalk.blue.underline('Info'));
```

> npm a telecharge chalk dans le dossier `node_modules/` et l'a ajoute aux dependances du `package.json`. Quand quelqu'un clone votre projet, il fait `npm install` et toutes les dependances sont reinstallees.

### [13:30-14:30] Recap

> On a vu les modules CommonJS et ES Modules pour organiser son code. Le module fs pour manipuler des fichiers. L'objet process pour interagir avec le systeme. Et npm pour gerer les dependances.

**Action** : Mentionner le lab associe.

> Dans le lab `labs/lab-02-modules-fs/`, vous allez creer vos propres modules, manipuler des fichiers, et construire un petit outil en ligne de commande. Allez-y, on se retrouve au prochain screencast pour les streams !

## Points d'attention pour l'enregistrement
- Nettoyer les fichiers de demo avant de commencer pour eviter les conflits
- Montrer clairement la difference entre require() et import dans le terminal
- S'assurer que chalk est compatible avec la version de Node.js utilisee
- Prendre le temps de montrer le contenu du node_modules/ pour demystifier
