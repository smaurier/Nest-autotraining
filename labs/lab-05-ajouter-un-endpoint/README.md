# Lab 05 — Intervention : ajouter un endpoint à une API existante, sans casser le contrat

> **Outcome :** à la fin, tu sais faire ce qui constitue la majorité du travail réel en
> mission : ajouter une capacité à une API **déjà en production**, consommée par un front que
> tu ne modifies pas, avec une suite de non-régression qui doit rester verte du début à la fin.
> **Vrai outil :** NestJS 11.2.5, supertest, Jest 30.
> **Feedback :** `npm run lab:05` — deux suites e2e : `regression.e2e-spec.ts` (déjà verte,
> doit le rester) et `get-by-id.e2e-spec.ts` (rouge, à faire passer au vert). `npm run
> solution:05` prouve l'oracle.

## Lire avant (une lecture bornée)

- Module [`10-nestjs-controllers.md`](../../modules/10-nestjs-controllers.md) — `@Get(":id")`,
  `@Param`, et pourquoi l'ORDRE des routes dans un controller peut compter (ici, sans ambiguïté :
  une seule route `GET` avec paramètre).
- La voie **lecture critique** en tête du parcours : avant de toucher au code, comprends ce qui
  tourne déjà et pourquoi `regression.e2e-spec.ts` doit rester vert à chaque étape.

## Énoncé

`GET /posts?familyId=` et `POST /posts` tournent déjà en production, consommés par un vrai
front. Le produit demande : *« un écran de détail d'un post, il faut pouvoir le récupérer par
son id. »*

Tu modifies **deux fichiers existants**, en place :

- `src/posts/posts.service.ts` — ajoute `getById(id: string): Post`, qui lève
  `NotFoundException` si absent (le repository a déjà `findById`, donné, non modifié).
- `src/posts/posts.controller.ts` — ajoute `GET /posts/:id`, qui délègue au service.

Rien d'autre ne bouge. Les deux routes existantes (`GET /posts`, `POST /posts`) doivent
produire **exactement** les mêmes réponses qu'avant — même statut, mêmes champs, dans le même
ordre de clés (le contrat que `regression.e2e-spec.ts` fige).

## Étapes (en friction)

1. Lance `npm run lab:05` une première fois : `regression.e2e-spec.ts` est déjà vert (4/4),
   `get-by-id.e2e-spec.ts` est rouge (3 échecs, la route n'existe pas).
2. Ajoute `getById` au service — trois lignes, appuyées sur `findById` du repository (donné).
3. Ajoute la route au controller — une méthode, elle délègue au service, rien d'autre.
4. Relance `npm run lab:05` après chaque étape.

## Vérifier

```bash
cd 09-nestjs/labs
npm install
npm run lab:05
```

**Ce que l'oracle vérifie**

Non-régression (4 cas, doivent rester verts) : `GET /posts?familyId=f1` renvoie les 2 posts
seedés avec exactement les 5 clés du contrat ; une famille inconnue renvoie `[]` (pas une
erreur) ; `POST /posts` crée avec la forme exacte ; un `content` vide → 400. Nouvelle capacité
(3 cas) : `GET /posts/p1` renvoie le post seedé avec la forme exacte du contrat ; un id inconnu
→ 404 ; un post fraîchement créé via `POST` est immédiatement trouvable via la nouvelle route.

## Variante J+30 (fading)

Le produit demande maintenant `DELETE /posts/:id`. Écris d'abord `regression.e2e-spec.ts`-style :
un test qui prouve que supprimer un post NE CASSE PAS `GET /posts?familyId=` pour les autres
posts de la même famille, puis implémente (`NotFoundException` si l'id n'existe pas, `204` sinon).

## Application TribuZen

Même diff sur `tribuzen-api/src/posts/`, branché sur l'écran de détail React. Commit :
`feat(posts): GET /posts/:id — sans régression sur les routes existantes`.
