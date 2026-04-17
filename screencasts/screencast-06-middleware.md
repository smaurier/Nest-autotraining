# Screencast 06 — Middleware & Architecture

## Informations

- **Duree estimee** : 15-18 min
- **Module** : `modules/06-express-middleware.md`
- **Lab associe** : `labs/lab-06-middleware/`
- **Prérequis** : Screencast 05 (Express Fondamentaux)

## Setup

- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Editeur de code ouvert
- [ ] Projet Express du screencast 05 disponible
- [ ] Port 3000 disponible

## Script

### [00:00-03:00] Introduction — Qu'est-ce qu'un middleware ?

> Salut ! On a vu comment créer des routes avec Express. Mais Express à un super-pouvoir qu'on n'a pas encore explore : les middlewares. Un middleware, c'est une fonction qui s'exécuté entre la requête et la réponse.

**Action** : Afficher le slide de titre "Module 06 — Middleware & Architecture".

> Imaginez une chaine de montage. La requête arrive, passe par une serie de middlewares, chacun fait son travail — logger, vérifier l'authentification, parser le body — et à la fin, le handler de route produit la réponse. C'est le pattern middleware.

**Action** : Dessiner le schema de la chaine middleware.

> Un middleware, c'est une fonction avec trois paramètres : `req`, `res`, et `next`. `next()` passe au middleware suivant. Si vous ne l'appelez pas, la chaine s'arrete.

### [03:00-07:00] Créer ses propres middlewares

**Action** : Créer un projet avec des middlewares personnalises.

```javascript
// app.js
const express = require("express");
const app = express();

// Middleware de logging
function logger(req, res, next) {
  const start = Date.now();
  console.log(`--> ${req.method} ${req.url}`);

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `<-- ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`,
    );
  });

  next();
}

// Middleware de timing
function timing(req, res, next) {
  res.setHeader("X-Response-Time", Date.now().toString());
  next();
}

// Middleware d'authentification simple
function auth(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(401).json({ error: "Token manquant" });
  }
  if (token !== "Bearer secret-token") {
    return res.status(403).json({ error: "Token invalide" });
  }
  req.user = { id: 1, role: "admin" };
  next();
}

// Appliquer les middlewares globaux
app.use(express.json());
app.use(logger);
app.use(timing);

// Route publique
app.get("/api/public", (req, res) => {
  res.json({ message: "Acces libre" });
});

// Routes protegees (middleware sur le groupe)
app.get("/api/admin", auth, (req, res) => {
  res.json({ message: "Zone admin", user: req.user });
});

app.listen(3000, () => console.log("Serveur sur http://localhost:3000"));
```

**Action** : Tester les middlewares.

```bash
node app.js
```

```bash
# Route publique - les middlewares logger et timing s'executent
curl http://localhost:3000/api/public

# Route protegee sans token - bloque par le middleware auth
curl http://localhost:3000/api/admin

# Route protegee avec token
curl -H "Authorization: Bearer secret-token" http://localhost:3000/api/admin
```

> Regardez le terminal : le middleware logger affiche chaque requête avec sa duree. Le middleware auth bloque l'acces sans token. Et quand le token est valide, il attache l'utilisateur a `req.user` pour que le handler de route puisse l'utiliser.

### [07:00-11:00] Express Router — Organiser les routes

> Quand l'application grandit, mettre toutes les routes dans un seul fichier devient ingerable. Express.Router permet de découper les routes en modules.

**Action** : Créer une structure de fichiers avec Router.

```javascript
// routes/users.js
const express = require("express");
const router = express.Router();

const users = [
  { id: 1, name: "Alice", role: "admin" },
  { id: 2, name: "Bob", role: "user" },
];

router.get("/", (req, res) => {
  res.json(users);
});

router.get("/:id", (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: "Non trouve" });
  res.json(user);
});

router.post("/", (req, res) => {
  const user = { id: users.length + 1, ...req.body };
  users.push(user);
  res.status(201).json(user);
});

module.exports = router;
```

```javascript
// routes/products.js
const express = require("express");
const router = express.Router();

const products = [
  { id: 1, name: "Laptop", price: 999 },
  { id: 2, name: "Phone", price: 699 },
];

router.get("/", (req, res) => res.json(products));
router.get("/:id", (req, res) => {
  const product = products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: "Non trouve" });
  res.json(product);
});

module.exports = router;
```

```javascript
// app.js
const express = require("express");
const usersRouter = require("./routes/users");
const productsRouter = require("./routes/products");

const app = express();
app.use(express.json());
app.use("/api/users", usersRouter);
app.use("/api/products", productsRouter);

app.listen(3000, () => console.log("Serveur sur http://localhost:3000"));
```

**Action** : Tester la structure modulaire.

```bash
curl http://localhost:3000/api/users
curl http://localhost:3000/api/products
```

> Chaque Router est un mini-application avec ses propres routes. On les monte sur un prefixe dans l'app principale. C'est propre, maintenable, et ça permet a plusieurs développeurs de travailler sur des parties différentes.

### [11:00-15:00] Architecture MVC — Separer les responsabilites

> Allons plus loin dans l'organisation. Le pattern MVC (Model-View-Controller) separe les donnees (Model), la logique de présentation (View), et la logique metier (Controller).

**Action** : Montrer la structure MVC.

```
express-demo/
  controllers/
    user.controller.js
  services/
    user.service.js
  routes/
    user.routes.js
  app.js
```

```javascript
// services/user.service.js
let users = [{ id: 1, name: "Alice" }];
let nextId = 2;

exports.findAll = () => users;
exports.findById = (id) => users.find((u) => u.id === id);
exports.create = (data) => {
  const user = { id: nextId++, ...data };
  users.push(user);
  return user;
};
```

```javascript
// controllers/user.controller.js
const userService = require("../services/user.service");

exports.getAll = (req, res) => {
  res.json(userService.findAll());
};

exports.getById = (req, res) => {
  const user = userService.findById(Number(req.params.id));
  if (!user) return res.status(404).json({ error: "Non trouve" });
  res.json(user);
};

exports.create = (req, res) => {
  const user = userService.create(req.body);
  res.status(201).json(user);
};
```

> Le service contient la logique metier. Le controller fait le lien entre la requête HTTP et le service. Les routes connectent les URLs aux controllers. C'est exactement l'architecture que NestJS va formaliser avec les decorateurs.

### [15:00-16:30] Bonus BFF — Endpoint oriente ecran

> En contexte BFF, on ne renvoie pas un CRUD brut. On renvoie une reponse orientee composant frontend.

**Action** : Montrer un endpoint `/bff/dashboard` qui agrege profil + notifications et renvoie une shape adaptee au front.

**Action** : Ajouter un middleware de correlation id pour tracer les appels.

### [15:00-17:00] Recap

> Les middlewares sont le coeur d'Express. Ils permettent de créer des pipelines de traitement reuti1isables. Le Router organise les routes en modules. Et le pattern MVC separe les responsabilites.

**Action** : Afficher le slide recap.

> Le lab est dans `labs/lab-06-middleware/`. Vous allez créer vos propres middlewares, organiser votre code avec Router, et appliquer le pattern MVC. C'est une base essentielle pour comprendre NestJS. A bientot !

## Points d'attention pour l'enregistrement

- Bien montrer l'ordre d'exécution des middlewares dans le terminal (logs)
- Insister sur l'importance de next() — sans lui, la requête reste en attente
- Montrer la structure de dossiers dans l'explorateur de fichiers de VS Code
- Faire le parallele avec NestJS qui formalisera ces patterns
