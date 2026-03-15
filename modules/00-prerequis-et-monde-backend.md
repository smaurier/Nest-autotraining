# Module 00 — Prerequis & Le monde du backend

> **Objectif** : Comprendre ce qu'est le backend, le modele client-serveur, le protocole HTTP en detail, installer un environnement de travail complet (Node.js, npm, VS Code, Postman) et executer son premier script Node.js.
>
> **Difficulte** : ⭐ (debutant)

---

## 1. Ce que ce cours va t'apprendre

Ce cours est un parcours complet qui t'emmene de zero connaissance backend jusqu'a la maitrise de NestJS, le framework Node.js le plus structure et le plus utilise en entreprise. Voici la progression :

| Bloc | Modules | Competences |
|---|---|---|
| **Node.js fondamental** | 00 – 04 | Event loop, modules, streams, serveur HTTP natif |
| **Express.js** | 05 – 08 | Routing, middleware, validation, authentification |
| **NestJS** | 09 – 12 | Controllers, providers, DI, modules, architecture |

> **Analogie** : Imagine que tu veux construire un immeuble. D'abord tu apprends a manipuler les materiaux bruts (Node.js), ensuite tu utilises des outils pour aller plus vite (Express), et enfin tu adoptes un plan d'architecture complet avec des normes de construction (NestJS). Chaque etape enrichit la precedente.

### Ce que ce cours n'est PAS

- Ce n'est pas un cours de frontend : on suppose que tu connais HTML, CSS, JavaScript et idealement TypeScript.
- Ce n'est pas un cours de base de donnees : on travaillera avec des donnees en memoire ou des fichiers. Pour les bases de donnees, consulte le cours PostgreSQL.
- Ce n'est pas un cours theorique : chaque module contient du code executable et des exercices pratiques.

---

## 2. Qu'est-ce que le backend

### 2.1 Definition

Le **backend** (ou cote serveur) est la partie d'une application qui s'execute sur un serveur distant. C'est le cerveau invisible derriere l'interface que voit l'utilisateur. Il gere :

1. **La logique metier** : regles de calcul, workflows, decisions
2. **Le stockage des donnees** : bases de donnees, fichiers, caches
3. **L'authentification et l'autorisation** : qui peut faire quoi
4. **Les integrations** : API tierces, envoi d'emails, paiements
5. **La securite** : validation, chiffrement, protection contre les attaques

> **Analogie** : Quand tu vas au restaurant, le **frontend** c'est la salle — la decoration, le menu, le serveur qui prend ta commande. Le **backend** c'est la cuisine — la ou le plat est prepare, ou les ingredients sont stockes, ou les recettes sont appliquees. Le client ne voit jamais la cuisine, mais c'est elle qui fait tout le travail.

### 2.2 Frontend vs Backend

| Aspect | Frontend | Backend |
|---|---|---|
| **Ou ca tourne** | Navigateur du client | Serveur distant |
| **Langages** | HTML, CSS, JavaScript | Node.js, Python, Java, Go, C#... |
| **Responsabilite** | Interface utilisateur, interactions | Logique metier, donnees, securite |
| **Acces aux donnees** | Via des requetes HTTP (API) | Directement (base de donnees) |
| **Securite** | Le code est visible par l'utilisateur | Le code est invisible |
| **Exemples de frameworks** | Angular, React, Vue | Express, NestJS, Django, Spring |

> **Piege classique** : Ne mets JAMAIS de logique sensible dans le frontend. Un utilisateur peut inspecter et modifier tout le code JavaScript qui tourne dans son navigateur. La validation, l'authentification et les regles metier doivent TOUJOURS etre verifiees cote backend.

### 2.3 Le modele client-serveur

Le web fonctionne sur un modele **client-serveur** :

```
  ┌──────────┐                          ┌──────────┐
  │          │   1. Requete HTTP         │          │
  │  CLIENT  │ ─────────────────────────▶│ SERVEUR  │
  │(navigateur│                          │ (Node.js)│
  │ ou app)  │◀───────────────────────── │          │
  │          │   2. Reponse HTTP         │          │
  └──────────┘                          └──────────┘
```

1. Le **client** (navigateur, application mobile, Postman...) envoie une **requete HTTP**
2. Le **serveur** recoit la requete, la traite, et renvoie une **reponse HTTP**
3. Le client interprete la reponse (affiche du HTML, lit du JSON, etc.)

> **A retenir** : Le serveur ne contacte jamais le client de lui-meme (dans le modele HTTP classique). C'est toujours le client qui initie la communication. Pour du temps reel (notifications, chat), on utilise des WebSockets — mais ce n'est pas du HTTP standard.

### 2.4 API — Application Programming Interface

Une **API** est un contrat entre le client et le serveur. Elle definit :

- Quelles **URL** (endpoints) sont disponibles
- Quelles **methodes HTTP** utiliser
- Quel **format de donnees** envoyer et recevoir
- Quels **codes de reponse** attendre

```
  Application Frontend (Angular, React...)
        │
        │  Appel API : GET /api/users
        ▼
  ┌──────────────────────┐
  │      API REST         │  ← Contrat : "Voici les endpoints disponibles"
  │  (serveur Node.js)    │
  └──────────────────────┘
        │
        │  Requete SQL : SELECT * FROM users
        ▼
  ┌──────────────────────┐
  │   Base de donnees     │
  └──────────────────────┘
```

---

## 3. Le protocole HTTP en detail

### 3.1 Qu'est-ce que HTTP

**HTTP** (HyperText Transfer Protocol) est le protocole de communication du web. C'est un protocole **sans etat** (stateless) : chaque requete est independante, le serveur ne "se souvient" pas des requetes precedentes.

> **Analogie** : HTTP, c'est comme envoyer des lettres a une entreprise. Chaque lettre (requete) contient toutes les informations necessaires : qui tu es, ce que tu veux, les documents joints. L'entreprise (serveur) repond avec une lettre (reponse) contenant le resultat. Elle ne se souvient pas de tes lettres precedentes — tu dois tout rappeler a chaque fois.

### 3.2 Anatomie d'une requete HTTP

```
┌─────────────────────────────────────────────────┐
│  POST /api/users HTTP/1.1                       │  ← Ligne de requete
│                                                 │     (methode + URL + version)
│  Host: api.example.com                          │
│  Content-Type: application/json                 │  ← En-tetes (headers)
│  Authorization: Bearer eyJhbGciOiJIUzI1NiJ9... │
│  Accept: application/json                       │
│                                                 │
│  {                                              │
│    "nom": "Alice Dupont",                       │  ← Corps (body)
│    "email": "alice@example.com"                 │
│  }                                              │
└─────────────────────────────────────────────────┘
```

### 3.3 Les methodes HTTP

| Methode | Role | Idempotent | Corps | Exemple |
|---|---|---|---|---|
| **GET** | Recuperer une ressource | Oui | Non | `GET /api/users/42` |
| **POST** | Creer une ressource | Non | Oui | `POST /api/users` |
| **PUT** | Remplacer une ressource completement | Oui | Oui | `PUT /api/users/42` |
| **PATCH** | Modifier partiellement une ressource | Non* | Oui | `PATCH /api/users/42` |
| **DELETE** | Supprimer une ressource | Oui | Non** | `DELETE /api/users/42` |
| **HEAD** | Comme GET mais sans le body | Oui | Non | `HEAD /api/users/42` |
| **OPTIONS** | Decouvrir les methodes autorisees | Oui | Non | `OPTIONS /api/users` |

> **A retenir** : **Idempotent** signifie que repeter la meme requete produit le meme resultat. `DELETE /users/42` execute 10 fois donne le meme resultat : l'utilisateur 42 est supprime (les 9 fois suivantes, il est deja supprime). `POST /users` execute 10 fois cree 10 utilisateurs — ce n'est PAS idempotent.

### 3.4 Les status codes HTTP

Les codes de reponse HTTP sont regroupes en 5 familles :

#### 1xx — Informations

| Code | Nom | Signification |
|---|---|---|
| 100 | Continue | Le serveur a recu les headers, le client peut envoyer le body |
| 101 | Switching Protocols | Changement de protocole (ex: upgrade vers WebSocket) |

#### 2xx — Succes

| Code | Nom | Utilisation |
|---|---|---|
| **200** | OK | Requete reussie (GET, PUT, PATCH) |
| **201** | Created | Ressource creee avec succes (POST) |
| **204** | No Content | Succes sans contenu (DELETE) |

#### 3xx — Redirections

| Code | Nom | Utilisation |
|---|---|---|
| 301 | Moved Permanently | Redirection permanente (SEO) |
| 302 | Found | Redirection temporaire |
| 304 | Not Modified | Ressource non modifiee (cache) |

#### 4xx — Erreurs client

| Code | Nom | Cause |
|---|---|---|
| **400** | Bad Request | Donnees invalides envoyees par le client |
| **401** | Unauthorized | Authentification requise ou invalide |
| **403** | Forbidden | Authentifie mais pas les droits |
| **404** | Not Found | Ressource inexistante |
| **405** | Method Not Allowed | Methode HTTP non supportee sur cet endpoint |
| **409** | Conflict | Conflit (ex: email deja pris) |
| **422** | Unprocessable Entity | Donnees bien formees mais semantiquement invalides |
| **429** | Too Many Requests | Rate limiting depasse |

#### 5xx — Erreurs serveur

| Code | Nom | Cause |
|---|---|---|
| **500** | Internal Server Error | Bug dans le code du serveur |
| **502** | Bad Gateway | Le serveur proxy a recu une reponse invalide |
| **503** | Service Unavailable | Serveur en surcharge ou en maintenance |
| **504** | Gateway Timeout | Le serveur proxy n'a pas recu de reponse a temps |

> **Bonne pratique** : Utilise toujours le status code le plus precis possible. Ne renvoie pas `200` pour tout — si tu crees une ressource, renvoie `201`. Si tu supprimes, renvoie `204`. Un bon usage des status codes rend ton API previsible et facile a deboguer.

### 3.5 Les headers HTTP importants

| Header | Direction | Role | Exemple |
|---|---|---|---|
| `Content-Type` | Requete/Reponse | Format du body | `application/json` |
| `Accept` | Requete | Formats acceptes par le client | `application/json` |
| `Authorization` | Requete | Jeton d'authentification | `Bearer eyJhb...` |
| `Set-Cookie` | Reponse | Definir un cookie | `session=abc; HttpOnly` |
| `Access-Control-Allow-Origin` | Reponse | Autoriser le CORS | `http://localhost:4200` |
| `Cache-Control` | Reponse | Politique de cache | `max-age=3600` |
| `Content-Length` | Reponse | Taille du body en octets | `1234` |
| `X-Request-Id` | Les deux | Identifiant unique de requete | `uuid-v4` |

### 3.6 Le CORS (Cross-Origin Resource Sharing)

```
  Navigateur                           Serveur API
  (localhost:4200)                     (localhost:3000)
       │                                    │
       │  1. Preflight OPTIONS /api/users   │
       │───────────────────────────────────▶│
       │                                    │
       │  2. 200 OK                         │
       │  Access-Control-Allow-Origin: *    │
       │◀───────────────────────────────────│
       │                                    │
       │  3. GET /api/users                 │
       │───────────────────────────────────▶│
       │                                    │
       │  4. 200 OK (data)                  │
       │◀───────────────────────────────────│
```

Le CORS est un mecanisme de securite du **navigateur** (pas du serveur). Il empeche un site web de faire des requetes vers un domaine different sans autorisation explicite.

> **Piege classique** : "Mon API fonctionne avec Postman mais pas depuis mon app Angular !" — C'est du CORS. Postman ne passe pas par un navigateur, donc il ignore le CORS. En developpement, configure ton serveur pour autoriser `localhost:4200` (ou `*` mais jamais en production).

### 3.7 Le body : JSON et form-data

```typescript
// Format JSON (le plus courant pour les API)
{
  "nom": "Alice Dupont",
  "email": "alice@example.com",
  "age": 28
}

// Content-Type: application/json
```

```
# Format form-data (pour l'upload de fichiers)
------boundary123
Content-Disposition: form-data; name="nom"

Alice Dupont
------boundary123
Content-Disposition: form-data; name="avatar"; filename="photo.jpg"
Content-Type: image/jpeg

(contenu binaire du fichier)
------boundary123--

# Content-Type: multipart/form-data; boundary=----boundary123
```

---

## 4. REST — Representational State Transfer

### 4.1 Principes REST

REST est un style d'architecture pour les API. Il repose sur des conventions :

| Principe | Description |
|---|---|
| **Ressources** | Chaque entite est une ressource identifiee par une URL |
| **Methodes HTTP** | Chaque action correspond a une methode HTTP |
| **Stateless** | Chaque requete contient toutes les informations necessaires |
| **Representations** | Les ressources sont representees en JSON (ou XML, etc.) |

### 4.2 Conventions de nommage des endpoints

| Action | Methode | Endpoint | Description |
|---|---|---|---|
| Lister | GET | `/api/users` | Recuperer tous les utilisateurs |
| Lire | GET | `/api/users/:id` | Recuperer un utilisateur par ID |
| Creer | POST | `/api/users` | Creer un nouvel utilisateur |
| Remplacer | PUT | `/api/users/:id` | Remplacer completement un utilisateur |
| Modifier | PATCH | `/api/users/:id` | Modifier partiellement un utilisateur |
| Supprimer | DELETE | `/api/users/:id` | Supprimer un utilisateur |

```typescript
// Exemple de reponse pour GET /api/users
{
  "data": [
    { "id": 1, "nom": "Alice", "email": "alice@example.com" },
    { "id": 2, "nom": "Bob", "email": "bob@example.com" }
  ],
  "total": 2,
  "page": 1,
  "limit": 10
}

// Exemple de reponse pour GET /api/users/1
{
  "id": 1,
  "nom": "Alice",
  "email": "alice@example.com",
  "createdAt": "2024-01-15T10:30:00Z"
}

// Exemple de body pour POST /api/users
{
  "nom": "Charlie",
  "email": "charlie@example.com"
}

// Reponse : 201 Created
{
  "id": 3,
  "nom": "Charlie",
  "email": "charlie@example.com",
  "createdAt": "2024-06-20T14:00:00Z"
}
```

> **Bonne pratique** : Utilise des **noms pluriels** pour les ressources (`/users`, pas `/user`). Utilise des **tirets** pour les mots composes (`/order-items`, pas `/orderItems`). N'inclus pas de verbes dans les URLs (`/users`, pas `/getUsers`) — la methode HTTP porte deja le verbe.

---

## 5. Setup complet de l'environnement

### 5.1 Installation de Node.js

Node.js est un **runtime JavaScript** qui permet d'executer du JavaScript en dehors du navigateur. Il est base sur le moteur **V8** de Chrome.

**Installation (Windows)** :

1. Va sur https://nodejs.org
2. Telecharge la version **LTS** (Long Term Support) — actuellement Node.js 22 LTS (recommande) ou 24
3. Execute l'installateur, coche toutes les options par defaut
4. Verifie l'installation :

```bash
# Verifier les versions installees
node --version
# v20.11.0 (ou superieur)

npm --version
# 10.2.4 (ou superieur)
```

> **A retenir** : Utilise toujours la version **LTS** de Node.js, pas la version "Current". La LTS est plus stable et supportee plus longtemps. En entreprise, c'est toujours la LTS qui est utilisee.

### 5.2 npm — Node Package Manager

**npm** est le gestionnaire de paquets de Node.js. Il te permet d'installer des librairies tierces.

```bash
# Creer un nouveau projet
mkdir mon-projet
cd mon-projet
npm init -y

# Installer un paquet (dependance de production)
npm install express

# Installer un paquet de developpement
npm install --save-dev nodemon

# Installer un paquet globalement
npm install -g typescript

# Desinstaller un paquet
npm uninstall express
```

### 5.3 Anatomie du package.json

```json
{
  "name": "mon-api",
  "version": "1.0.0",
  "description": "Mon premier projet backend",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  },
  "keywords": [],
  "author": "Ton nom",
  "license": "ISC"
}
```

| Champ | Role |
|---|---|
| `name` | Nom du projet (minuscules, pas d'espaces) |
| `version` | Version semantique (major.minor.patch) |
| `scripts` | Commandes raccourcies (`npm run dev`) |
| `dependencies` | Paquets necessaires en production |
| `devDependencies` | Paquets necessaires uniquement en developpement |

### 5.4 Extensions VS Code recommandees

| Extension | Role |
|---|---|
| **REST Client** ou **Thunder Client** | Tester des requetes HTTP directement dans VS Code |
| **ESLint** | Linting du code JavaScript/TypeScript |
| **Prettier** | Formatage automatique du code |
| **Error Lens** | Affiche les erreurs directement dans le code |
| **GitLens** | Historique Git enrichi |
| **dotenv** | Coloration syntaxique des fichiers `.env` |

### 5.5 Postman ou Thunder Client

Pour tester tes API, tu auras besoin d'un outil pour envoyer des requetes HTTP :

- **Postman** (application desktop) : le plus complet, avec collections, variables d'environnement, tests automatises
- **Thunder Client** (extension VS Code) : leger, integre a VS Code, parfait pour debuter

> **Bonne pratique** : Ne teste pas tes API uniquement depuis le navigateur. Le navigateur ne peut envoyer que des requetes GET facilement. Pour POST, PUT, DELETE, tu as besoin de Postman ou Thunder Client.

---

## 6. Premier script Node.js

### 6.1 Hello World

Cree un fichier `hello.js` :

```typescript
// hello.js
console.log('Hello, World !');
console.log('Bienvenue dans le monde du backend.');
console.log(`Node.js version : ${process.version}`);
console.log(`Systeme d'exploitation : ${process.platform}`);
console.log(`Repertoire courant : ${process.cwd()}`);
```

Execute-le :

```bash
node hello.js
# Hello, World !
# Bienvenue dans le monde du backend.
# Node.js version : v20.11.0
# Systeme d'exploitation : win32
# Repertoire courant : C:\Users\toi\mon-projet
```

### 6.2 Un script plus interessant

```typescript
// info.js
const os = require('os');

console.log('=== Informations systeme ===');
console.log(`Hostname    : ${os.hostname()}`);
console.log(`OS          : ${os.type()} ${os.release()}`);
console.log(`Architecture: ${os.arch()}`);
console.log(`CPUs        : ${os.cpus().length} coeurs`);
console.log(`RAM totale  : ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} Go`);
console.log(`RAM libre   : ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} Go`);
console.log(`Uptime      : ${(os.uptime() / 3600).toFixed(1)} heures`);
```

### 6.3 Comprendre la difference avec le navigateur

```typescript
// Ceci fonctionne dans le navigateur mais PAS dans Node.js :
// document.getElementById('app');  // Erreur : document n'existe pas
// window.alert('test');            // Erreur : window n'existe pas

// Ceci fonctionne dans Node.js mais PAS dans le navigateur :
const fs = require('fs');           // Acces au systeme de fichiers
const os = require('os');           // Informations systeme
const http = require('http');       // Creer un serveur HTTP

// Ceci fonctionne dans les DEUX :
console.log('Hello');
setTimeout(() => {}, 1000);
JSON.parse('{}');
Math.random();
```

| Disponible dans | Node.js | Navigateur |
|---|---|---|
| `console` | Oui | Oui |
| `setTimeout/setInterval` | Oui | Oui |
| `JSON`, `Math`, `Date` | Oui | Oui |
| `require` / `import` | Oui (modules) | Oui (ESM) |
| `document`, `window`, `DOM` | Non | Oui |
| `fs`, `path`, `os`, `http` | Oui | Non |
| `process` | Oui | Non |
| `fetch` | Oui (Node 18+) | Oui |

---

## 7. Le REPL Node.js interactif

Le **REPL** (Read-Eval-Print Loop) est un terminal interactif Node.js :

```bash
# Lancer le REPL
node

# Tu peux maintenant taper du JavaScript directement :
> 2 + 3
5

> const message = 'Bonjour'
undefined

> message.toUpperCase()
'BONJOUR'

> Array.from({ length: 5 }, (_, i) => i * 2)
[ 0, 2, 4, 6, 8 ]

> const http = require('http')
undefined

> .exit
# ou Ctrl+C deux fois
```

Commandes speciales du REPL :

| Commande | Role |
|---|---|
| `.help` | Affiche l'aide |
| `.clear` | Remet a zero le contexte |
| `.exit` | Quitte le REPL |
| `.save fichier.js` | Sauvegarde la session dans un fichier |
| `.load fichier.js` | Charge et execute un fichier |

> **Bonne pratique** : Le REPL est parfait pour tester rapidement un bout de code, verifier le comportement d'une methode ou explorer un module. Mais pour du vrai code, utilise toujours des fichiers `.js` ou `.ts`.

---

## 8. Structure du cours et comment l'aborder

### 8.1 Parcours recommande

```
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │  Node.js     │     │  Express     │     │  NestJS      │
  │  Modules     │────▶│  Modules     │────▶│  Modules     │
  │  00 – 04     │     │  05 – 08     │     │  09 – 12     │
  └─────────────┘     └─────────────┘     └─────────────┘
    Fondations          Framework            Architecture
    bas niveau          minimaliste          entreprise
```

### 8.2 Pour chaque module

1. **Lis le cours** en entier, meme si tu crois connaitre le sujet
2. **Tape le code** toi-meme (ne copie-colle pas)
3. **Fais les exercices** a la fin de chaque module
4. **Fais le lab** associe pour mettre en pratique
5. **Passe le quiz** pour valider tes connaissances

### 8.3 Prerequis techniques

| Prerequis | Niveau attendu | Ou l'apprendre |
|---|---|---|
| **JavaScript** | Bon (ES6+, async/await, destructuring, spread) | MDN, javascript.info |
| **TypeScript** | Bases (types, interfaces, generics) | Necessaire a partir du module 09 (NestJS) |
| **Terminal** | Bases (cd, mkdir, ls, npm) | Pratique quotidienne |
| **Git** | Bases (init, add, commit, push) | Indispensable en entreprise |
| **JSON** | Lecture et ecriture | Utilise partout dans les API |

---

## 9. Exercice pratique — Premier contact

### Exercice 1 : Installation et verification

```bash
# 1. Verifie que Node.js est installe
node --version

# 2. Verifie que npm est installe
npm --version

# 3. Cree un dossier de travail
mkdir nest-course-exercices
cd nest-course-exercices

# 4. Initialise un projet npm
npm init -y

# 5. Cree ton premier fichier
```

### Exercice 2 : Exploration du protocole HTTP

Avec Postman ou Thunder Client, envoie les requetes suivantes vers `https://jsonplaceholder.typicode.com` :

```
1. GET    /posts          → Liste tous les posts (combien y en a-t-il ?)
2. GET    /posts/1        → Recupere le post avec l'ID 1
3. POST   /posts          → Cree un nouveau post (body JSON)
4. PUT    /posts/1        → Remplace le post 1
5. PATCH  /posts/1        → Modifie partiellement le post 1
6. DELETE /posts/1        → Supprime le post 1
```

Pour le POST, utilise ce body :

```json
{
  "title": "Mon premier post",
  "body": "Ceci est un test depuis Postman",
  "userId": 1
}
```

**Questions** :
- Quel status code recois-tu pour chaque requete ?
- Quel header `Content-Type` est present dans les reponses ?
- Que se passe-t-il si tu fais `GET /posts/9999` ?

### Exercice 3 : Premier script avec arguments

```typescript
// exercice3.js
// Ecris un script qui :
// 1. Lit les arguments de la ligne de commande (process.argv)
// 2. Affiche un message de bienvenue personnalise
// 3. Affiche la date et l'heure actuelles

const args = process.argv.slice(2);
const prenom = args[0] || 'Inconnu';

console.log(`Bonjour ${prenom} !`);
console.log(`Il est ${new Date().toLocaleTimeString('fr-FR')}`);
console.log(`Nous sommes le ${new Date().toLocaleDateString('fr-FR')}`);
```

```bash
node exercice3.js Alice
# Bonjour Alice !
# Il est 14:30:00
# Nous sommes le 07/03/2026
```

---

## 10. Resume — Les concepts cles

| Concept | Definition |
|---|---|
| **Backend** | Code qui s'execute cote serveur |
| **HTTP** | Protocole de communication client-serveur |
| **REST** | Style d'architecture pour les API |
| **Status code** | Code numerique indiquant le resultat d'une requete |
| **Header** | Metadonnees d'une requete ou reponse HTTP |
| **JSON** | Format d'echange de donnees standard |
| **Node.js** | Runtime JavaScript cote serveur |
| **npm** | Gestionnaire de paquets pour Node.js |
| **CORS** | Mecanisme de securite du navigateur |
| **Idempotent** | Operation qui produit le meme resultat si repetee |

> **A retenir** : Le backend est le cerveau de toute application web. HTTP est le langage de communication entre client et serveur. REST est la convention qui structure cette communication. Node.js est l'outil qui te permet d'ecrire du backend en JavaScript — le meme langage que tu utilises deja en frontend.

---

## Navigation

| | Lien |
|---|---|
| Module suivant | [Module 01 — Node.js — Event Loop & Asynchrone](./01-nodejs-event-loop.md) |
| Quiz | [Quiz Module 00](../quizzes/00-prerequis-et-monde-backend.quiz.md) |
| Lab | Pas de lab pour ce module d'introduction |

---

> **A retenir** : Avant de plonger dans le code, assure-toi d'avoir bien compris le modele client-serveur, les methodes HTTP et les status codes. Ce vocabulaire te suivra tout au long du cours et de ta carriere backend. Installe Node.js, ouvre VS Code, lance ton premier `node hello.js` — le voyage commence maintenant.
