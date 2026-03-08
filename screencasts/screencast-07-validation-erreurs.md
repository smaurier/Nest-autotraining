# Screencast 07 — Validation & Erreurs

## Informations
- **Duree estimee** : 12-15 min
- **Module** : `modules/07-express-validation-erreurs.md`
- **Lab associe** : `labs/lab-07-validation-erreurs/`
- **Prerequis** : Screencast 06 (Middleware & Architecture)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Editeur de code ouvert
- [ ] Port 3000 disponible

## Script

### [00:00-02:30] Introduction — Pourquoi valider ?

> Salut ! Aujourd'hui on va parler de deux sujets critiques : la validation des donnees et la gestion des erreurs. Parce que ne jamais faire confiance aux donnees du client, c'est la regle numero un du backend.

**Action** : Afficher le slide de titre "Module 07 — Validation & Erreurs".

> Un utilisateur peut envoyer n'importe quoi dans une requete : un email invalide, un nombre negatif, une chaine de 10000 caracteres. Si vous ne validez pas, vous risquez des bugs, des crashes, voire des failles de securite.

**Action** : Initialiser le projet.

```bash
mkdir validation-demo && cd validation-demo
npm init -y
npm install express zod
```

### [02:30-06:00] Validation avec Zod

> Zod est une librairie de validation TypeScript-first. Elle permet de definir des schemas et de valider les donnees entrantes de maniere declarative.

**Action** : Creer un schema de validation avec Zod.

```javascript
// app.js
const express = require('express');
const { z } = require('zod');
const app = express();

app.use(express.json());

// Schema de validation pour un utilisateur
const createUserSchema = z.object({
  name: z.string().min(2, 'Le nom doit faire au moins 2 caracteres'),
  email: z.string().email('Email invalide'),
  age: z.number().int().min(18, 'Doit avoir au moins 18 ans').optional(),
  role: z.enum(['admin', 'user']).default('user'),
});

const updateUserSchema = createUserSchema.partial();

// Middleware de validation generique
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation echouee',
        details: result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

const users = [];
let nextId = 1;

app.post('/api/users', validate(createUserSchema), (req, res) => {
  const user = { id: nextId++, ...req.body };
  users.push(user);
  res.status(201).json(user);
});

app.put('/api/users/:id', validate(updateUserSchema), (req, res) => {
  const user = users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Non trouve' });
  Object.assign(user, req.body);
  res.json(user);
});

app.listen(3000, () => console.log('Serveur sur http://localhost:3000'));
```

**Action** : Tester la validation avec des donnees invalides.

```bash
# Donnees valides
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com"}' \
  http://localhost:3000/api/users

# Nom trop court
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"A","email":"alice@test.com"}' \
  http://localhost:3000/api/users

# Email invalide
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Bob","email":"pas-un-email"}' \
  http://localhost:3000/api/users

# Corps vide
curl -X POST -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:3000/api/users
```

> Zod rejette les donnees invalides avec des messages clairs. Le middleware `validate` est reutilisable sur n'importe quelle route. On definit le schema une fois, on l'applique partout.

### [06:00-09:00] Classes d'erreurs personnalisees

> Maintenant, gerons les erreurs proprement. Au lieu de faire `res.status(404)` partout, on va creer des classes d'erreurs.

**Action** : Creer des classes d'erreurs.

```javascript
// errors.js
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Ressource') {
    super(`${resource} non trouve(e)`, 404);
  }
}

class ValidationError extends AppError {
  constructor(details) {
    super('Erreur de validation', 400);
    this.details = details;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Non autorise') {
    super(message, 401);
  }
}

module.exports = { AppError, NotFoundError, ValidationError, UnauthorizedError };
```

> On a une hierarchie d'erreurs. `AppError` est la classe de base. `NotFoundError`, `ValidationError`, `UnauthorizedError` heritent d'elle. Chaque erreur sait quel code HTTP elle produit.

### [09:00-12:00] Middleware de gestion d'erreurs centralise

> Le vrai pouvoir, c'est le middleware d'erreur centralise. Express le reconnait grace a ses quatre parametres : `err, req, res, next`.

**Action** : Ajouter le error handler.

```javascript
// Middleware d'erreur (4 parametres !)
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${err.message}`);

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Erreur non prevue
  console.error(err.stack);
  res.status(500).json({
    error: 'Erreur interne du serveur',
  });
}

// Dans les routes, on lance des erreurs
app.get('/api/users/:id', (req, res, next) => {
  try {
    const user = users.find(u => u.id === Number(req.params.id));
    if (!user) throw new NotFoundError('Utilisateur');
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Le error handler en dernier !
app.use(errorHandler);
```

**Action** : Tester la gestion d'erreurs.

```bash
# Ressource non trouvee
curl http://localhost:3000/api/users/999

# Route inexistante
curl http://localhost:3000/api/inexistant
```

> L'erreur est catchee par le middleware centralise. Un seul endroit pour formater les reponses d'erreur, logger, et eventuellement notifier un service de monitoring. C'est propre et maintenable.

### [12:00-14:00] Recap

> Resumons. Zod pour valider les donnees entrantes de maniere declarative. Des classes d'erreurs pour typer les erreurs. Un middleware centralise pour les gerer uniformement. Ce pattern est universel — on le retrouvera dans NestJS avec les Pipes et les ExceptionFilters.

**Action** : Afficher le slide recap.

> Le lab est dans `labs/lab-07-validation-erreurs/`. Vous allez implementer la validation Zod et la gestion d'erreurs centralisee dans votre API. C'est un pattern essentiel. A bientot pour l'authentification !

## Points d'attention pour l'enregistrement
- Montrer les messages d'erreur Zod clairement dans le terminal
- Insister sur les 4 parametres du error handler Express (err, req, res, next)
- Bien montrer la difference entre erreur operationnelle et erreur imprevue
- Faire le lien avec les Pipes NestJS qui feront la meme chose de maniere plus elegante
