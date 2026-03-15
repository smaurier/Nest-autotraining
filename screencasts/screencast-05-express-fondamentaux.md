# Screencast 05 — Express Fondamentaux

## Informations
- **Duree estimee** : 15-20 min
- **Module** : `modules/05-express-fondamentaux.md`
- **Lab associe** : `labs/lab-05-express-crud/`
- **Prérequis** : Screencast 04 (Serveur HTTP natif)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Editeur de code ouvert
- [ ] Thunder Client ou Postman installe dans VS Code
- [ ] Port 3000 disponible

## Script

### [00:00-03:00] Introduction — Express en action

> Salut ! Dans le screencast précédent, on a construit un serveur HTTP à la main. C'etait instructif mais penible. Aujourd'hui, on passe a Express — le framework web le plus populaire de Node.js. En quelques minutes, on va construire une API CRUD complete.

**Action** : Afficher le slide de titre "Module 05 — Express Fondamentaux".

**Action** : Initialiser un nouveau projet.

```bash
mkdir express-demo && cd express-demo
npm init -y
npm install express
```

**Action** : Créer le fichier principal.

```javascript
// app.js
const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Bienvenue sur l\'API Express !' });
});

app.listen(3000, () => {
  console.log('Serveur Express sur http://localhost:3000');
});
```

```bash
node app.js
curl http://localhost:3000
```

> Trois lignes et on à un serveur avec parsing JSON automatique. Comparez avec ce qu'on faisait à la main : pas de `parseBody`, pas de `writeHead`, pas de `JSON.stringify`. Express fait tout ça pour nous.

### [03:00-08:00] CRUD complet — Taches todo

> On va construire une API REST complete pour gérer des taches. Create, Read, Update, Delete.

**Action** : Écrire l'API CRUD.

```javascript
// app.js
const express = require('express');
const app = express();

app.use(express.json());

let todos = [
  { id: 1, title: 'Apprendre Express', done: false },
  { id: 2, title: 'Construire une API', done: false },
];
let nextId = 3;

// GET /api/todos - Lister toutes les taches
app.get('/api/todos', (req, res) => {
  res.json(todos);
});

// GET /api/todos/:id - Une tache par ID
app.get('/api/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === Number(req.params.id));
  if (!todo) {
    return res.status(404).json({ error: 'Tache non trouvee' });
  }
  res.json(todo);
});

// POST /api/todos - Creer une tache
app.post('/api/todos', (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Le titre est requis' });
  }
  const todo = { id: nextId++, title, done: false };
  todos.push(todo);
  res.status(201).json(todo);
});

// PUT /api/todos/:id - Modifier une tache
app.put('/api/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === Number(req.params.id));
  if (!todo) {
    return res.status(404).json({ error: 'Tache non trouvee' });
  }
  Object.assign(todo, req.body);
  res.json(todo);
});

// DELETE /api/todos/:id - Supprimer une tache
app.delete('/api/todos/:id', (req, res) => {
  const index = todos.findIndex(t => t.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Tache non trouvee' });
  }
  todos.splice(index, 1);
  res.status(204).send();
});

app.listen(3000, () => console.log('API sur http://localhost:3000'));
```

**Action** : Démarrer le serveur et tester chaque endpoint.

```bash
node app.js
```

### [08:00-12:00] Tester avec Thunder Client / curl

> On va tester chaque endpoint. Je vais utiliser Thunder Client dans VS Code, mais vous pouvez utiliser curl ou Postman.

**Action** : Ouvrir Thunder Client et tester les routes.

```bash
# Lister les taches
curl http://localhost:3000/api/todos

# Creer une tache
curl -X POST -H "Content-Type: application/json" \
  -d '{"title":"Faire le lab 05"}' \
  http://localhost:3000/api/todos

# Modifier une tache
curl -X PUT -H "Content-Type: application/json" \
  -d '{"done":true}' \
  http://localhost:3000/api/todos/1

# Supprimer une tache
curl -X DELETE http://localhost:3000/api/todos/2

# Verifier le resultat
curl http://localhost:3000/api/todos
```

> Chaque méthode HTTP a sa route. GET pour lire, POST pour créer, PUT pour modifier, DELETE pour supprimer. C'est le pattern REST. Les paramètres de route comme `:id` sont accessibles via `req.params`.

### [12:00-16:00] Query params et filtrage

> En plus des paramètres de route, on peut utiliser les query parameters pour filtrer les résultats.

**Action** : Ajouter le filtrage par statut.

```javascript
// GET /api/todos?done=true
app.get('/api/todos', (req, res) => {
  let result = todos;

  if (req.query.done !== undefined) {
    const isDone = req.query.done === 'true';
    result = result.filter(t => t.done === isDone);
  }

  if (req.query.search) {
    result = result.filter(t =>
      t.title.toLowerCase().includes(req.query.search.toLowerCase())
    );
  }

  res.json(result);
});
```

**Action** : Tester les filtres.

```bash
curl "http://localhost:3000/api/todos?done=false"
curl "http://localhost:3000/api/todos?search=express"
```

> `req.query` contient tous les paramètres après le `?` dans l'URL. C'est parse automatiquement par Express. Pas besoin de decoder l'URL à la main.

### [16:00-18:30] Recap — Express simplifie tout

> Resumons ce qu'on a construit. Une API REST complete avec Express : listing, création, modification, suppression, filtrage. En moins de 50 lignes de code.

**Action** : Afficher le slide comparatif http natif vs Express.

> Express nous donne le routing declartif avec `app.get()`, `app.post()`, etc. Le parsing JSON automatique avec `express.json()`. Les paramètres de route avec `req.params`. Les query parameters avec `req.query`. Et des méthodes de réponse pratiques comme `res.json()` et `res.status()`.

> Dans le prochain screencast, on va découvrir les middlewares — c'est la ou la puissance d'Express se revele vraiment. Le lab est dans `labs/lab-05-express-crud/`. Construisez votre propre API CRUD et testez-la avec Thunder Client. A tout de suite !

## Points d'attention pour l'enregistrement
- Montrer Thunder Client en parallele de curl pour que le public choisisse son outil
- Bien montrer le code de statut 201 pour POST et 204 pour DELETE
- Insister sur la différence entre req.params et req.query
- S'assurer que les donnees persistent entre les requêtes (mémoire, pas de redemarrage)
