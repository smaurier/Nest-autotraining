# Screencast 08 — Auth & Securite

## Informations
- **Duree estimee** : 18-22 min
- **Module** : `modules/08-express-auth-securite.md`
- **Lab associe** : `labs/lab-08-auth-jwt/`
- **Prerequis** : Screencast 07 (Validation & Erreurs)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Editeur de code ouvert
- [ ] Port 3000 disponible

## Script

### [00:00-03:00] Introduction — Pourquoi l'authentification ?

> Salut ! Aujourd'hui on va implementer un systeme d'authentification complet avec bcrypt et JWT. C'est un sujet fondamental : sans auth, n'importe qui peut acceder a vos donnees.

**Action** : Afficher le slide de titre "Module 08 — Auth & Securite".

> Le flux est simple : l'utilisateur s'inscrit avec un email et un mot de passe. On hash le mot de passe avec bcrypt. Ensuite il se connecte, on verifie le mot de passe, et on lui donne un token JWT. Ce token, il le renvoie a chaque requete pour prouver son identite.

**Action** : Initialiser le projet.

```bash
mkdir auth-demo && cd auth-demo
npm init -y
npm install express bcryptjs jsonwebtoken zod
```

### [03:00-07:00] bcrypt — Hasher les mots de passe

> Regle numero un : ne jamais stocker un mot de passe en clair. Jamais. On utilise bcrypt pour le hasher.

**Action** : Demontrer bcrypt.

```javascript
// bcrypt-demo.js
const bcrypt = require('bcryptjs');

async function demo() {
  const password = 'monMotDePasse123';

  // Hasher le mot de passe
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  console.log('Hash :', hash);

  // Verifier le mot de passe
  const isValid = await bcrypt.compare(password, hash);
  console.log('Valide :', isValid); // true

  const isInvalid = await bcrypt.compare('mauvaisMotDePasse', hash);
  console.log('Invalide :', isInvalid); // false
}

demo();
```

```bash
node bcrypt-demo.js
```

> Le hash est different a chaque execution grace au salt. Meme si deux utilisateurs ont le meme mot de passe, leurs hash seront differents. Et c'est a sens unique : impossible de retrouver le mot de passe a partir du hash.

### [07:00-12:00] JWT — JSON Web Tokens

> Le JWT, c'est un token signe qui contient des informations sur l'utilisateur. Il est compose de trois parties : le header, le payload, et la signature.

**Action** : Demontrer la creation et la verification de JWT.

```javascript
// jwt-demo.js
const jwt = require('jsonwebtoken');

const SECRET = 'ma-cle-secrete-a-ne-pas-commiter';

// Creer un token
const token = jwt.sign(
  { userId: 1, email: 'alice@test.com', role: 'admin' },
  SECRET,
  { expiresIn: '1h' }
);
console.log('Token :', token);

// Decoder (sans verifier)
const decoded = jwt.decode(token);
console.log('Decode :', decoded);

// Verifier le token
try {
  const verified = jwt.verify(token, SECRET);
  console.log('Verifie :', verified);
} catch (err) {
  console.error('Token invalide :', err.message);
}
```

> Maintenant, assemblons tout dans une API complete avec register, login et routes protegees.

**Action** : Creer l'API d'authentification.

```javascript
// app.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const app = express();
app.use(express.json());

const SECRET = 'super-secret-key';
const users = [];

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Minimum 8 caracteres'),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register
app.post('/api/auth/register', async (req, res) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }

  const { email, password, name } = result.data;

  if (users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'Email deja utilise' });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = { id: users.length + 1, email, name, password: hash };
  users.push(user);

  res.status(201).json({ message: 'Utilisateur cree', id: user.id });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }

  const { email, password } = result.data;
  const user = users.find(u => u.email === email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    SECRET,
    { expiresIn: '1h' }
  );

  res.json({ token });
});

app.listen(3000, () => console.log('Auth API sur http://localhost:3000'));
```

### [12:00-16:00] Middleware d'authentification et routes protegees

**Action** : Ajouter le middleware auth et les routes protegees.

```javascript
// Middleware d'authentification
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalide ou expire' });
  }
}

// Route protegee
app.get('/api/profile', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.user.userId);
  res.json({ id: user.id, email: user.email, name: user.name });
});

// Route admin
app.get('/api/admin/users', authMiddleware, (req, res) => {
  res.json(users.map(u => ({ id: u.id, email: u.email, name: u.name })));
});
```

**Action** : Tester le flux complet.

```bash
# 1. Register
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com","password":"monpassword"}' \
  http://localhost:3000/api/auth/register

# 2. Login
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"monpassword"}' \
  http://localhost:3000/api/auth/login

# 3. Acceder au profil avec le token
curl -H "Authorization: Bearer <VOTRE_TOKEN>" \
  http://localhost:3000/api/profile

# 4. Sans token
curl http://localhost:3000/api/profile
```

> Le flux est complet : register hash le mot de passe, login verifie et renvoie un JWT, le middleware extrait le user du token. On retrouvera exactement ce pattern dans NestJS avec Passport.

### [16:00-19:00] Bonnes pratiques de securite

> Quelques regles essentielles pour la securite.

**Action** : Afficher la checklist de securite.

> Premierement, le secret JWT doit etre dans une variable d'environnement, jamais dans le code. Deuxiemement, les tokens doivent expirer. Une heure c'est bien, une semaine c'est dangereux. Troisiemement, utilisez HTTPS en production. Le token passe dans les headers, sans HTTPS il est visible en clair.

```javascript
// Bonne pratique : secret dans une variable d'environnement
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('JWT_SECRET non defini !');
  process.exit(1);
}
```

> Quatriemement, ne mettez jamais d'informations sensibles dans le payload du JWT. Le payload est encode en base64, pas chiffre. N'importe qui peut le lire.

### [19:00-20:30] Recap

> On a implemente un systeme d'authentification complet : bcrypt pour hasher les mots de passe, JWT pour les tokens, middleware pour proteger les routes. Ce pattern est la fondation de l'auth dans NestJS.

**Action** : Mentionner le lab.

> Le lab est dans `labs/lab-08-auth-jwt/`. Vous allez construire votre propre systeme d'auth avec register, login et routes protegees. Au prochain screencast, on attaque NestJS !

## Points d'attention pour l'enregistrement
- Ne pas montrer de vrais secrets a l'ecran, utiliser des valeurs d'exemple
- Copier-coller le token JWT depuis la reponse login pour la requete profile
- Montrer ce qui se passe quand le token expire (changer expiresIn a quelques secondes)
- Insister sur le fait que JWT encode != chiffre
