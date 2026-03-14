# Lab 26 — GraphQL avec NestJS (Code-First)

## Objectif

Construire une API GraphQL **code-first** avec NestJS pour gérer une collection de livres et leurs auteurs.

Vous allez :

1. Définir des **ObjectTypes** GraphQL (`Book`, `Author`) avec les décorateurs `@ObjectType`, `@Field`, `@Int`
2. Créer des **InputTypes** (`CreateBookInput`, `UpdateBookInput`) pour les mutations
3. Implémenter un **Resolver** avec :
   - Des `@Query` pour lister, chercher et récupérer un livre
   - Des `@Mutation` pour créer, modifier et supprimer un livre
   - Un `@ResolveField` pour résoudre la relation `author` d'un livre
4. Utiliser un store en mémoire (pas de base de données)

## Schéma GraphQL attendu

```graphql
type Book {
  id: Int!
  title: String!
  year: Int!
  genre: String!
  author: Author!
}

type Author {
  id: Int!
  name: String!
  nationality: String!
}

type Query {
  books: [Book!]!
  book(id: Int!): Book
  searchBooks(term: String!): [Book!]!
}

input CreateBookInput {
  title: String!
  year: Int!
  genre: String!
  authorId: Int!
}

input UpdateBookInput {
  title: String
  year: Int
  genre: String
}

type Mutation {
  createBook(input: CreateBookInput!): Book!
  updateBook(id: Int!, input: UpdateBookInput!): Book
  deleteBook(id: Int!): Boolean!
}
```

## Instructions

### Étape 1 — Modèles GraphQL

Ouvrez les fichiers dans `src/books/models/` et ajoutez les décorateurs GraphQL manquants (`@ObjectType`, `@Field`, `@Int`).

- `book.model.ts` — Le type `Book` avec ses champs
- `author.model.ts` — Le type `Author` avec ses champs

### Étape 2 — Input Types (DTO)

Ouvrez les fichiers dans `src/books/dto/` et ajoutez les décorateurs manquants (`@InputType`, `@Field`).

- `create-book.input.ts` — Input pour la création d'un livre
- `update-book.input.ts` — Input pour la mise à jour (champs optionnels)

### Étape 3 — Resolver

Ouvrez `src/books/books.resolver.ts` et implémentez :

1. Le décorateur `@Resolver(() => Book)` sur la classe
2. `@Query(() => [Book])` pour `books()` — retourne tous les livres
3. `@Query(() => Book, { nullable: true })` pour `book(id)` — retourne un livre par ID
4. `@Query(() => [Book])` pour `searchBooks(term)` — recherche par terme
5. `@Mutation(() => Book)` pour `createBook(input)` — crée un livre
6. `@Mutation(() => Book, { nullable: true })` pour `updateBook(id, input)` — met à jour
7. `@Mutation(() => Boolean)` pour `deleteBook(id)` — supprime un livre
8. `@ResolveField(() => Author)` pour `author(book)` — résout l'auteur

### Services fournis

Les services `BooksService` et `AuthorsService` sont déjà implémentés avec des données en mémoire. Vous n'avez pas besoin de les modifier.

## Lancer les tests

```bash
# Installer les dépendances
pnpm install

# Lancer les tests (exercice)
pnpm test

# Lancer les tests (solution)
pnpm test:solution
```

## Playground GraphQL

```bash
pnpm start:dev
```

Ouvrez [http://localhost:3000/graphql](http://localhost:3000/graphql) pour tester vos requêtes dans le playground Apollo.

## Exemples de requêtes

```graphql
# Lister tous les livres
query {
  books {
    id
    title
    year
    genre
    author {
      name
      nationality
    }
  }
}

# Chercher un livre par ID
query {
  book(id: 1) {
    title
    author {
      name
    }
  }
}

# Créer un livre
mutation {
  createBook(input: {
    title: "Nouveau Livre"
    year: 2024
    genre: "Science-Fiction"
    authorId: 1
  }) {
    id
    title
    author {
      name
    }
  }
}
```

## Solution

Les fichiers corrigés se trouvent dans le dossier `solution/`.
