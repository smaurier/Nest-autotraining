# Lab 06 — Middleware Express

## Objectifs

- Comprendre le concept de middleware dans Express
- Creer des middleware personnalises (logger, timer, auth)
- Creer une factory de middleware (validation)
- Organiser les routes avec `express.Router()`
- Appliquer des middleware selectivement sur certaines routes

## Pre-requis

- Node.js >= 18 installe
- Installer les dependances : `npm install` dans ce repertoire

## Instructions

1. Installez les dependances : `npm install`
2. Ouvrez le fichier `exercise.js`
3. Completez chaque section marquee `TODO`
4. Lancez le fichier avec `node exercise.js`
5. Verifiez que tous les tests passent (8/8)

## TODOs

| # | Description |
|---|-------------|
| 1 | Creer `loggerMiddleware` — log method, url et timestamp sur chaque requete |
| 2 | Creer `timerMiddleware` — mesure le temps de reponse et ajoute `X-Response-Time` |
| 3 | Creer `authMiddleware` — verifie le header `Authorization: Bearer secret-token` |
| 4 | Creer `validateBody(schema)` — factory qui retourne un middleware de validation |
| 5 | Creer un Router `/users` avec les routes CRUD |
| 6 | Creer un Router `/products` avec les routes CRUD |
| 7 | Assembler l'app : middleware globaux + routers + middleware selectif |

## Aide

```js
// Middleware basique
function myMiddleware(req, res, next) {
  // faire quelque chose...
  next(); // passer au middleware suivant
}

// Factory de middleware
function createValidator(schema) {
  return (req, res, next) => {
    // valider req.body avec le schema
    next();
  };
}

// Router
const router = express.Router();
router.get('/', handler);
router.post('/', middleware, handler);

app.use('/prefix', router);
```
