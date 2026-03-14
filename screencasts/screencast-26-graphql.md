# Screencast 26 — GraphQL avec NestJS

## Informations
- **Duree estimee** : 20-25 min
- **Module** : `modules/26-graphql-nestjs.md`
- **Lab associe** : `labs/lab-26-graphql/`
- **Prerequis** : Screencasts 09-13 (NestJS fondamentaux)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Editeur de code ouvert
- [ ] Port 3000 disponible
- [ ] Navigateur pour le playground GraphQL

## Script

### [00:00-03:00] Introduction — REST vs GraphQL

> Bienvenue dans le module 26. Jusqu'ici, toutes nos APIs etaient en REST. Aujourd'hui, on decouvre GraphQL — un langage de requete pour les APIs cree par Facebook en 2012. Ce n'est pas un remplacement de REST, c'est une alternative pour des cas d'usage specifiques.

**Action** : Afficher le slide "Over-fetching et Under-fetching".

> Le probleme principal de REST : le over-fetching et le under-fetching. Quand un frontend mobile a besoin du nom et du prix d'un produit, REST lui renvoie les 20 champs du produit. Et s'il a besoin des reviews en plus, il doit faire une deuxieme requete. Avec GraphQL, le client demande exactement ce qu'il veut, et il obtient exactement ca.

**Action** : Montrer une requete GraphQL.

```graphql
# Le client demande exactement ce qu'il veut
query {
  product(id: 42) {
    name
    price
    reviews {
      rating
      comment
    }
  }
}
```

> Une seule requete, exactement les champs demandes. Pas de over-fetching, pas de under-fetching.

### [03:00-07:00] Setup — NestJS + Apollo Server

**Action** : Installer les dependances.

```bash
npm install @nestjs/graphql @nestjs/apollo @apollo/server graphql
```

**Action** : Configurer le module GraphQL.

```typescript
// src/app.module.ts
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true, // Code-first : le schema est genere automatiquement
      playground: true,     // Active le playground GraphQL
    }),
    BooksModule,
  ],
})
export class AppModule {}
```

> NestJS supporte deux approches : code-first et schema-first. On utilise code-first — le schema GraphQL est genere automatiquement a partir des decorateurs TypeScript. C'est l'approche recommandee car le schema reste en sync avec le code.

### [07:00-12:00] ObjectTypes et Resolvers — Code-first

**Action** : Definir les types GraphQL.

```typescript
// src/books/models/book.model.ts
@ObjectType()
export class Book {
  @Field(() => Int)
  id: number;

  @Field()
  title: string;

  @Field(() => Int)
  year: number;

  @Field()
  genre: string;

  @Field(() => Author, { nullable: true })
  author?: Author;
}
```

> @ObjectType est l'equivalent de @Entity pour GraphQL. @Field est l'equivalent de @Column. La difference : @Field definit ce qui est EXPOSE dans l'API, pas ce qui est stocke en base.

**Action** : Implementer le resolver.

```typescript
// src/books/books.resolver.ts
@Resolver(() => Book)
export class BooksResolver {
  constructor(
    private booksService: BooksService,
    private authorsService: AuthorsService,
  ) {}

  @Query(() => [Book])
  books() {
    return this.booksService.findAll();
  }

  @Query(() => Book, { nullable: true })
  book(@Args('id', { type: () => Int }) id: number) {
    return this.booksService.findOne(id);
  }

  @Mutation(() => Book)
  createBook(@Args('input') input: CreateBookInput) {
    return this.booksService.create(input);
  }

  @ResolveField(() => Author)
  author(@Parent() book: Book) {
    return this.authorsService.findOne(book.authorId);
  }
}
```

> Le resolver est l'equivalent du controller en REST. @Query remplace @Get, @Mutation remplace @Post/@Patch/@Delete. La grosse difference, c'est @ResolveField : il permet de resoudre une relation a la demande. Si le client ne demande pas l'auteur, la methode n'est jamais appelee.

### [12:00-16:00] Le playground et les tests

**Action** : Ouvrir le playground GraphQL dans le navigateur.

```bash
# Demarrer l'application
npm run start:dev

# Ouvrir http://localhost:3000/graphql
```

> Le playground est un outil extraordinaire. Vous avez l'autocompletion, la documentation, l'historique des requetes. C'est l'equivalent de Swagger pour GraphQL, mais en mieux — le client peut construire ses requetes interactivement.

**Action** : Tester des requetes dans le playground.

```graphql
# Lister tous les livres avec leurs auteurs
query {
  books {
    id
    title
    year
    author {
      name
      nationality
    }
  }
}

# Creer un livre
mutation {
  createBook(input: {
    title: "Clean Code"
    year: 2008
    genre: "Programming"
    authorId: 1
  }) {
    id
    title
  }
}

# Rechercher
query {
  searchBooks(term: "clean") {
    id
    title
    genre
  }
}
```

### [16:00-20:00] Le probleme N+1 et DataLoader

> Il y a un piege majeur avec GraphQL : le probleme N+1. Si vous demandez 10 livres avec leurs auteurs, @ResolveField appelle authorsService.findOne 10 fois. 1 requete pour les livres + 10 requetes pour les auteurs = 11 requetes au lieu de 2.

**Action** : Montrer le probleme N+1 avec les logs.

```
Query books:     SELECT * FROM books              -- 1 requete
ResolveField:    SELECT * FROM authors WHERE id=1  -- +1
ResolveField:    SELECT * FROM authors WHERE id=2  -- +1
ResolveField:    SELECT * FROM authors WHERE id=1  -- +1 (doublon !)
ResolveField:    SELECT * FROM authors WHERE id=3  -- +1
...                                                 -- = N+1 requetes
```

**Action** : Montrer la solution avec DataLoader.

```typescript
// src/books/authors.loader.ts
@Injectable({ scope: Scope.REQUEST })
export class AuthorsLoader {
  constructor(private authorsService: AuthorsService) {}

  readonly loader = new DataLoader<number, Author>(
    async (ids: readonly number[]) => {
      const authors = await this.authorsService.findByIds([...ids]);
      const map = new Map(authors.map(a => [a.id, a]));
      return ids.map(id => map.get(id));
    },
  );
}

// Dans le resolver :
@ResolveField(() => Author)
author(@Parent() book: Book) {
  return this.authorsLoader.loader.load(book.authorId);
}
```

> DataLoader regroupe toutes les demandes d'auteurs en une seule requete : `SELECT * FROM authors WHERE id IN (1, 2, 3)`. Au lieu de N+1 requetes, on a 2 requetes. C'est indispensable en production.

### [20:00-23:00] GraphQL vs REST — Quand choisir quoi ?

**Action** : Afficher le tableau comparatif.

> REST est le bon choix quand : l'API est simple (CRUD classique), les clients sont uniformes (un seul frontend), ou quand le caching HTTP est important (GET avec ETag/Cache-Control).

> GraphQL est le bon choix quand : plusieurs clients ont des besoins differents (mobile vs desktop vs API partenaire), les donnees sont fortement interconnectees, ou quand vous voulez eviter la proliferation d'endpoints.

> Dans la pratique, beaucoup d'equipes utilisent les deux : REST pour les operations simples et publiques, GraphQL pour les interfaces riches et internes.

### [23:00-25:00] Recapitulatif

> GraphQL avec NestJS, c'est code-first avec @ObjectType, @Field, @Query, @Mutation, @ResolveField. Le playground remplace Swagger pour l'exploration. DataLoader resout le probleme N+1. Et c'est complementaire a REST, pas un remplacement.

> Faites le Lab 26 pour implementer votre premiere API GraphQL avec des livres et des auteurs !

## Points d'attention pour l'enregistrement
- Le playground GraphQL est le moment "wow" — prendre le temps de montrer l'autocompletion et la documentation
- Le probleme N+1 doit etre montre avec des logs reels pour que l'etudiant comprenne l'impact
- DataLoader est un concept avance — expliquer le batching clairement
- Comparer systematiquement avec REST pour que les etudiants voient les correspondances
- Ne pas presenter GraphQL comme superieur a REST — insister sur la complementarite
