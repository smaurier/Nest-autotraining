# Lab 17 — Prisma Avance

## Objectifs

- Implementer la pagination par curseur (cursor-based pagination)
- Utiliser les ecritures imbriquees (nested writes) pour creer des commandes avec leurs items
- Implementer le soft delete avec un middleware Prisma
- Utiliser les transactions interactives pour annuler une commande

## Mise en place

```bash
npm install
npx prisma generate
npx prisma db push
```

## Lancer les tests

```bash
npm test
```

## Lancer les tests avec la solution

```bash
npm run test:solution
```

## Fichiers a completer (TODO)

1. **`src/prisma/prisma.service.ts`** — Etendre PrismaClient, ajouter le middleware soft delete avec `$use()`
2. **`src/products/products.controller.ts`** — Endpoints avec pagination par curseur et soft delete
3. **`src/products/products.service.ts`** — `findWithCursorPagination()` et `softDelete()`
4. **`src/orders/orders.controller.ts`** — Endpoints pour creer, lister et annuler des commandes
5. **`src/orders/orders.service.ts`** — `createWithItems()` (nested write), `findAll()`, `cancelOrder()` (transaction interactive)

## Concepts cles

### Pagination par curseur
Contrairement a la pagination par offset (`skip/take`), la pagination par curseur utilise l'ID du dernier element pour determiner le point de depart de la page suivante. C'est plus performant pour les grands ensembles de donnees.

### Soft Delete
Au lieu de supprimer physiquement un enregistrement, on marque la date de suppression (`deletedAt`). Un middleware Prisma filtre automatiquement les enregistrements soft-deleted.

### Nested Writes
Prisma permet de creer un enregistrement et ses relations en une seule operation. Utile pour creer une commande avec ses items.

### Transactions interactives
`$transaction(async (tx) => { ... })` permet d'executer plusieurs operations dans une transaction. Si une erreur est lancee, toutes les operations sont annulees.

## Endpoints attendus

### Products
- `POST /products` — Creer un produit
- `GET /products?cursor=X&take=10` — Lister avec pagination par curseur
- `DELETE /products/:id` — Soft delete

### Orders
- `POST /orders` — Creer une commande avec items (nested write)
- `GET /orders` — Lister les commandes avec items et produits
- `PATCH /orders/:id/cancel` — Annuler une commande (transaction)

## Solutions

Les solutions se trouvent dans le dossier `solution/`.
