# Screencast 00 — Prérequis & Le monde du backend

## Informations
- **Duree estimee** : 12-15 min
- **Module** : `modules/00-prerequis-et-monde-backend.md`
- **Lab associe** : aucun
- **Prérequis** : Connaissances de base en HTML, CSS, JavaScript

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Editeur de code ouvert (VS Code recommande)
- [ ] Navigateur web disponible

## Script

### [00:00-02:30] Introduction — Le monde du backend

> Salut a tous ! Bienvenue dans cette formation complete sur Node.js et NestJS. Avant de coder quoi que ce soit, on va poser les bases. On va comprendre ce que c'est, le backend, pourquoi il existe, et comment il se distingue du frontend que vous connaissez déjà.

**Action** : Afficher le slide d'introduction avec le titre de la formation.

> Quand vous ouvrez un site web, votre navigateur affiche du HTML, du CSS, du JavaScript. C'est le frontend, la partie visible. Mais d'où viennent les donnees ? Qui vérifié votre mot de passe ? Qui stocke vos commandes ? C'est le backend. Le serveur qui travaille dans l'ombre.

**Action** : Afficher un schema client-serveur avec les fleches requête/réponse.

> Le backend, c'est le cerveau de l'application. Il recoit des requêtes HTTP du client, il les traite, il interroge une base de donnees si nécessaire, et il renvoie une réponse. C'est ce qu'on va apprendre à construire dans cette formation.

### [02:30-05:00] HTTP en 2 minutes — Le protocole qui relie tout

> Pour que le frontend et le backend communiquent, ils utilisent un protocole : HTTP. C'est un système de requête-réponse. Le client envoie une requête avec une méthode (GET, POST, PUT, DELETE), une URL, et parfois des donnees. Le serveur repond avec un code de statut et du contenu.

**Action** : Afficher un tableau des méthodes HTTP principales.

> GET pour lire, POST pour créer, PUT pour modifier, DELETE pour supprimer. Les codes de statut, c'est le langage du serveur : 200 OK, 201 Created, 404 Not Found, 500 Internal Server Error. On verra tout ça en detail quand on construira notre propre serveur HTTP.

**Action** : Ouvrir le terminal et montrer une requête curl simple.

```bash
curl -v https://jsonplaceholder.typicode.com/posts/1
```

> Voila ce qui se passe sous le capot quand votre navigateur charge une page. Du texte envoye, du texte recu. Rien de magique.

### [05:00-08:00] Pourquoi Node.js ? — JavaScript cote serveur

> Historiquement, le backend c'etait PHP, Java, Python. Et puis en 2009, Ryan Dahl a créé Node.js. L'idee geniale : prendre le moteur V8 de Chrome, celui qui exécuté le JavaScript dans votre navigateur, et le faire tourner sur un serveur.

**Action** : Afficher le logo Node.js et un schema montrant V8 + libuv.

> L'avantage ? Vous utilisez le même langage partout : JavaScript au frontend et au backend. Plus besoin de jongler entre deux langages. Et Node.js est non-bloquant, ce qui veut dire qu'il géré très bien les operations concurrentes comme les requêtes réseau ou les acces fichiers.

> Verifions que Node.js est bien installe sur votre machine.

**Action** : Ouvrir le terminal.

```bash
node --version
npm --version
```

> Vous devriez voir une version 20 ou superieure pour Node.js. npm, c'est le gestionnaire de paquets qui vient avec Node.js — on l'utilisera enormement.

### [08:00-11:00] Premier script — Hello depuis le backend

> On va écrire notre tout premier programme Node.js. Rien de complique, juste pour sentir la différence avec le navigateur.

**Action** : Créer un fichier `hello.js` dans l'editeur.

```javascript
// hello.js
console.log('Bonjour depuis le backend !');

const os = require('os');
console.log(`Machine : ${os.hostname()}`);
console.log(`OS : ${os.platform()}`);
console.log(`CPUs : ${os.cpus().length} coeurs`);
console.log(`Memoire : ${Math.round(os.totalmem() / 1024 / 1024)} MB`);
```

**Action** : Exécuter le script dans le terminal.

```bash
node hello.js
```

> Vous voyez ? On a acces a des informations système qui seraient impossibles a obtenir dans un navigateur. C'est ça, la puissance du backend : on peut lire des fichiers, acceder au système d'exploitation, ecouter sur un port réseau. Le navigateur est dans une sandbox, Node.js est libre.

### [11:00-13:00] Plan de la formation — La feuille de route

> Maintenant, voyons ce qui nous attend. Cette formation est structuree en 25 modules progressifs.

**Action** : Afficher la table des matieres de la formation.

> On commence par les fondamentaux de Node.js : l'event loop, les modules, les streams. Ensuite, on construit un serveur HTTP from scratch, puis on découvre Express pour simplifier tout ça. On ajoute la validation, la gestion d'erreurs, l'authentification.

> Et dans la deuxieme moitie, on passe a NestJS — le framework TypeScript qui structure tout. Controllers, providers, modules, pipes, guards. On connecte une base de donnees avec TypeORM et Prisma. On fait du testing, de l'auth avancee, des WebSockets, des queues. Et on termine par un projet final e-commerce complet.

**Action** : Montrer la structure du dossier de la formation.

```bash
ls modules/
ls labs/
```

> Chaque module a son screencast, son quiz, et son lab pratique. C'est en codant qu'on apprend, donc les labs sont essentiels.

### [13:00-14:30] Recap — On est prets

> Resumons. Le backend, c'est le serveur qui traite les requêtes, géré les donnees, et repond aux clients via HTTP. Node.js nous permet de faire ça en JavaScript. Et dans les prochains screencasts, on va plonger dans les mécanismes internes de Node.js en commencant par l'event loop.

**Action** : Afficher le slide de conclusion.

> Assurez-vous que Node.js 20+ est installe, ouvrez votre editeur de code, et on se retrouve dans le prochain screencast pour comprendre l'event loop. A tout de suite !

## Points d'attention pour l'enregistrement
- Garder un ton enthousiaste et accessible, c'est le premier contact avec la formation
- Ne pas trop s'attarder sur les details HTTP, ils seront couverts en profondeur au module 04
- Vérifier que `node --version` affiche bien la version 20+ avant d'enregistrer
- La demo `hello.js` doit fonctionner du premier coup pour donner confiance
