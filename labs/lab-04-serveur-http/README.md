# Lab 04 — Serveur HTTP Natif

## Objectifs

- Creer un serveur HTTP avec le module `http` natif de Node.js
- Implementer une API REST complete (CRUD) sans framework
- Parser les corps de requete JSON manuellement
- Gerer le routage, les codes de statut et les erreurs
- Ajouter des headers CORS

## Pre-requis

- Node.js >= 18 installe
- Aucune dependance externe (pure Node.js)

## Instructions

1. Ouvrez le fichier `exercise.ts`
2. Completez chaque section marquee `TODO`
3. Lancez le fichier avec `npx tsx exercise.ts`
4. Verifiez que tous les tests passent (10/10)

## TODOs

| # | Description |
|---|-------------|
| 1 | Implementer `parseBody(req)` — parser le corps JSON d'une requete |
| 2 | Implementer `sendJson(res, statusCode, data)` — envoyer une reponse JSON |
| 3 | Implementer `addCorsHeaders(res)` — ajouter les headers CORS |
| 4 | Implementer `GET /users` — lister tous les utilisateurs |
| 5 | Implementer `GET /users/:id` — recuperer un utilisateur par ID |
| 6 | Implementer `POST /users` — creer un utilisateur |
| 7 | Implementer `PUT /users/:id` — modifier un utilisateur |
| 8 | Implementer `DELETE /users/:id` — supprimer un utilisateur |
| 9 | Gerer les routes inconnues (404) et les erreurs JSON (400) |

## API Reference

| Methode | Route | Description | Status |
|---------|-------|-------------|--------|
| GET | /users | Liste tous les utilisateurs | 200 |
| GET | /users/:id | Recupere un utilisateur | 200 / 404 |
| POST | /users | Cree un utilisateur | 201 |
| PUT | /users/:id | Modifie un utilisateur | 200 / 404 |
| DELETE | /users/:id | Supprime un utilisateur | 204 / 404 |

## Aide

```typescript
import http from 'node:http';

const server = http.createServer((req, res) => {
  const { method, url } = req;

  // Parser l'URL
  const urlObj = new URL(url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  // Lire le body
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const data = JSON.parse(body);
  });

  // Envoyer une reponse
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'ok' }));
});
```
