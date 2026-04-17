# Screencast 04 — Serveur HTTP natif

## Informations
- **Duree estimee** : 15-20 min
- **Module** : `modules/04-nodejs-serveur-http.md`
- **Lab associe** : `labs/lab-04-serveur-http/`
- **Prérequis** : Screencast 03 (Streams & Buffers)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Editeur de code ouvert
- [ ] Port 3000 disponible
- [ ] curl ou Thunder Client installe

## Script

### [00:00-03:00] Introduction — HTTP from scratch

> Salut ! Aujourd'hui on va construire un serveur HTTP avec uniquement les modules built-in de Node.js. Pas de framework, pas de librairie externe. C'est important de comprendre ce qui se passe sous le capot avant d'utiliser Express ou NestJS.

**Action** : Afficher le slide de titre "Module 04 — Serveur HTTP natif".

> Node.js fournit un module `http` qui permet de créer un serveur en quelques lignes. La requête et la réponse sont des streams — exactement ce qu'on a vu au screencast précédent.

**Action** : Créer un fichier `server.js` dans l'editeur.

```javascript
// server.js
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bonjour depuis Node.js !');
});

server.listen(3000, () => {
  console.log('Serveur demarre sur http://localhost:3000');
});
```

**Action** : Lancer le serveur et tester avec curl.

```bash
node server.js
```

```bash
curl http://localhost:3000
```

> Quatre lignes et on à un serveur web fonctionnel. `createServer` prend un callback avec deux arguments : `req` (la requête, un Readable stream) et `res` (la réponse, un Writable stream).

### [03:00-07:00] Routing manuel — Gérer les chemins

> Un serveur qui repond la même chose a toutes les requêtes, c'est pas très utile. On va ajouter du routing.

**Action** : Modifier le serveur pour gérer plusieurs routes.

```javascript
// server-routes.js
const http = require('http');

const server = http.createServer((req, res) => {
  const { method, url } = req;

  res.setHeader('Content-Type', 'application/json');

  if (method === 'GET' && url === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({ message: 'Bienvenue sur l\'API' }));

  } else if (method === 'GET' && url === '/api/users') {
    const users = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    res.writeHead(200);
    res.end(JSON.stringify(users));

  } else if (method === 'GET' && url.startsWith('/api/users/')) {
    const id = url.split('/')[3];
    res.writeHead(200);
    res.end(JSON.stringify({ id: Number(id), name: 'Utilisateur ' + id }));

  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Route non trouvee' }));
  }
});

server.listen(3000, () => {
  console.log('Serveur demarre sur http://localhost:3000');
});
```

**Action** : Tester les différentes routes.

```bash
curl http://localhost:3000/
curl http://localhost:3000/api/users
curl http://localhost:3000/api/users/42
curl http://localhost:3000/api/inexistant
```

> On voit déjà le problème : le routing avec des if/else, ça devient vite un plat de spaghettis. C'est exactement pour ça qu'Express existe. Mais continuons, il y a encore des choses à comprendre.

### [07:00-11:00] Parser le corps de la requête — POST et JSON

> Quand un client envoie des donnees en POST, elles arrivent dans le corps de la requête. Comme la requête est un stream, il faut collecter les morceaux de donnees.

**Action** : Ajouter le parsing du corps de la requête.

```javascript
// server-post.js
const http = require('http');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

const users = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  res.setHeader('Content-Type', 'application/json');

  if (method === 'GET' && url === '/api/users') {
    res.writeHead(200);
    res.end(JSON.stringify(users));

  } else if (method === 'POST' && url === '/api/users') {
    const body = await parseBody(req);
    const newUser = { id: users.length + 1, name: body.name };
    users.push(newUser);
    res.writeHead(201);
    res.end(JSON.stringify(newUser));

  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Non trouve' }));
  }
});

server.listen(3000, () => console.log('Serveur sur http://localhost:3000'));
```

**Action** : Tester la création d'un utilisateur.

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Charlie"}' \
  http://localhost:3000/api/users

curl http://localhost:3000/api/users
```

> On a du écrire une fonction `parseBody` pour collecter les chunks du stream et parser le JSON. Avec Express, une seule ligne suffira. Mais maintenant vous comprenez ce qui se passe en coulisses.

### [11:00-15:00] Headers, CORS et fichiers statiques

> Les en-tetes HTTP sont essentiels. On va voir comment gérer les CORS et servir des fichiers statiques.

**Action** : Ajouter le support CORS.

```javascript
// Ajouter les headers CORS
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
```

### [15:00-17:00] Bonus — HEAD, OPTIONS et 405

> Deux methodes souvent oubliees: `HEAD` et `OPTIONS`. `HEAD` repond comme `GET` sans envoyer le body. `OPTIONS` annonce les methodes supportees et sert au preflight CORS.

**Action** : Ajouter `HEAD /api/users` et `OPTIONS /api/users`.

**Action** : Montrer un `405 Method Not Allowed` avec le header `Allow` quand la route existe mais que la methode est refusee.

**Action** : Ajouter le service de fichiers statiques.

```javascript
// Servir un fichier statique
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
};

function serveStatic(filePath, res) {
  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  const stream = fs.createReadStream(filePath);
  res.writeHead(200, { 'Content-Type': mime });
  stream.pipe(res);
  stream.on('error', () => {
    res.writeHead(404);
    res.end('Fichier non trouve');
  });
}
```

> On utilise `pipe` pour streamer le fichier directement dans la réponse. Pas de chargement en mémoire. Et on détecté le type MIME à partir de l'extension.

### [15:00-18:00] Recap — Les limites du http natif

> On a construit un serveur HTTP complet from scratch. Routing, parsing JSON, CORS, fichiers statiques. Mais regardez le code : c'est verbeux, fragile, et difficile a maintenir.

**Action** : Afficher le slide comparatif http natif vs Express.

> C'est exactement pour ça qu'on va utiliser Express dans le prochain screencast. Express fait tout ce qu'on vient de coder à la main, mais en beaucoup plus propre. Et NestJS va encore plus loin avec une architecture complete.

> Le lab est dans `labs/lab-04-serveur-http/`. Vous allez construire votre propre API REST avec le module http natif. C'est un excellent exercice pour solidifier vos bases. On se retrouve au prochain screencast pour découvrir Express !

## Points d'attention pour l'enregistrement
- Tuer le serveur entre chaque demo (Ctrl+C) pour éviter les conflits de port
- Montrer les réponses curl de manière lisible (utiliser jq si disponible)
- Insister sur le fait que req est un Readable stream et res un Writable stream
- La transition vers Express doit motiver le public a voir les limites de cette approche
