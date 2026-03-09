# Lab 05 — Express CRUD

## Objectifs

- Creer une application Express avec une API REST complete
- Gerer les routes CRUD (Create, Read, Update, Delete)
- Utiliser les bons codes de statut HTTP
- Valider les donnees entrantes
- Implementer un middleware d'erreur

## Pre-requis

- Node.js >= 18 installe
- Installer les dependances : `npm install` dans ce repertoire

## Instructions

1. Installez les dependances : `npm install`
2. Ouvrez le fichier `exercise.ts`
3. Completez chaque section marquee `TODO`
4. Lancez le fichier avec `npx tsx exercise.ts`
5. Verifiez que tous les tests passent (10/10)

## TODOs

| # | Description |
|---|-------------|
| 1 | Creer l'application Express avec `express.json()` |
| 2 | Implementer `GET /products` avec filtre optionnel `?category=` |
| 3 | Implementer `GET /products/:id` |
| 4 | Implementer `POST /products` avec validation (name, price, category requis) |
| 5 | Implementer `PUT /products/:id` (remplacement complet) |
| 6 | Implementer `PATCH /products/:id` (modification partielle) |
| 7 | Implementer `DELETE /products/:id` |
| 8 | Utiliser les bons status codes (201, 204, 400, 404) |
| 9 | Creer un middleware d'erreur centralise |

## API Reference

| Methode | Route | Description | Status |
|---------|-------|-------------|--------|
| GET | /products | Liste tous les produits (filtre ?category=) | 200 |
| GET | /products/:id | Recupere un produit | 200 / 404 |
| POST | /products | Cree un produit | 201 / 400 |
| PUT | /products/:id | Remplace un produit | 200 / 404 |
| PATCH | /products/:id | Modifie partiellement un produit | 200 / 404 |
| DELETE | /products/:id | Supprime un produit | 204 / 404 |

## Aide

```typescript
import express from 'express';

const app = express();
app.use(express.json());

app.get('/route', (req, res) => {
  res.json({ message: 'ok' });
});

// Middleware d'erreur (4 arguments)
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});
```
