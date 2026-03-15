# Module 26 — GraphQL avec NestJS

> **Objectif** : Maîtriser l'intégration de GraphQL dans NestJS avec Apollo Server. Comprendre les différences fondamentales avec REST, implementer des queries, mutations, subscriptions, gérer le problème N+1 avec DataLoader, sécuriser et paginer une API GraphQL.
> **Difficulte** : ⭐⭐⭐⭐ (avance+)
> **Prérequis** : Module 10 (Controllers & Providers), Module 13 (Guards & Pipes), Module 19 (Auth JWT)
> **Duree estimee** : 8 heures

---

## 1. REST vs GraphQL — Pourquoi une alternative ?

### 1.1 Les limites de REST

REST est un excellent paradigme architectural, mais il montre ses limites dans certains contextes :

**Over-fetching** : le client recoit plus de donnees que nécessaire.

```
GET /api/products/42
```

```json
{
  "id": 42,
  "name": "Clavier mecanique",
  "description": "Un clavier mecanique haut de gamme avec switches Cherry MX...",
  "price": 149.99,
  "stock": 23,
  "weight": 1.2,
  "dimensions": { "width": 44, "height": 3.5, "depth": 14 },
  "manufacturer": "KeyTech",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-03-01T14:22:00Z",
  "categoryId": 7,
  "supplierId": 12
}
```

Si le frontend n'a besoin que du `name` et du `price`, il recoit quand même tous les autres champs. Sur un réseau mobile, ça peut faire la différence.

**Under-fetching** : le client doit faire plusieurs requêtes pour obtenir les donnees liees.

```
GET /api/products/42          → le produit
GET /api/products/42/reviews  → les avis
GET /api/categories/7         → la categorie
```

Trois requêtes HTTP pour afficher une seule page produit. C'est du **under-fetching**.

> **Analogie** : Imagine que tu commandes au restaurant. Avec REST, tu dois demander le plat, puis separement les accompagnements, puis separement la sauce. Avec GraphQL, tu fais une seule commande : "Je veux le plat avec les frites et la sauce bearnaise". Le serveur te ramene tout en une fois, exactement ce que tu as demandé.

### 1.2 Qu'est-ce que GraphQL ?

GraphQL est un **langage de requête pour les API** et un **runtime** pour exécuter ces requêtes. Il a ete créé par Facebook en 2012 et rendu open source en 2015.

Principes fondamentaux :

| Principe | Description |
|---|---|
| **Schema fortement type** | Chaque API définit un schema avec des types précis |
| **Requête declarative** | Le client demandé exactement ce qu'il veut |
| **Un seul endpoint** | Tout passe par `POST /graphql` |
| **Introspection** | L'API peut decrire son propre schema |
| **Hierarchique** | Les requêtes suivent la structure des donnees |

### 1.3 Anatomie d'une requête GraphQL

```graphql
# Le client envoie cette requete
query {
  product(id: 42) {
    name
    price
    reviews {
      rating
      comment
    }
    category {
      name
    }
  }
}
```

```json
// Le serveur repond exactement avec cette structure
{
  "data": {
    "product": {
      "name": "Clavier mecanique",
      "price": 149.99,
      "reviews": [
        { "rating": 5, "comment": "Excellent !" },
        { "rating": 4, "comment": "Tres bon produit" }
      ],
      "category": {
        "name": "Peripheriques"
      }
    }
  }
}
```

**Une seule requête, exactement les champs demandes, avec les relations incluses.**

### 1.4 Les trois types d'operations

| Operation | Description | Equivalent REST |
|---|---|---|
| **Query** | Lecture de donnees | GET |
| **Mutation** | Création, modification, suppression | POST, PUT, PATCH, DELETE |
| **Subscription** | Donnees temps réel (WebSocket) | WebSocket / SSE |

### 1.5 REST vs GraphQL — Matrice de decision

| Critere | REST | GraphQL |
|---|---|---|
| **Simplicite** | Plus simple à apprendre | Courbe d'apprentissage plus forte |
| **Caching** | HTTP caching natif (GET) | Plus complexe (POST uniquement) |
| **Over/under-fetching** | Frequent | Elimine par design |
| **Versioning** | /api/v1, /api/v2 | Pas de versioning (evolution du schema) |
| **Upload fichiers** | Natif (multipart) | Nécessaire spec supplementaire |
| **Monitoring** | Un endpoint = une metrique | Tout passe par /graphql |
| **Outillage** | Swagger/OpenAPI | Playground, introspection |
| **Multi-clients** | Un endpoint par besoin (BFF) | Un seul schema, chaque client choisit ses champs |
| **Temps réel** | WebSocket a part | Subscriptions integrees |

**Quand utiliser REST** :
- API publique simple avec caching important
- CRUD classique avec peu de relations
- Équipe peu experimentee avec GraphQL
- Upload de fichiers intensif

**Quand utiliser GraphQL** :
- Plusieurs clients (web, mobile) avec des besoins différents
- Donnees fortement interconnectees (graphe)
- Frontend qui evolue rapidement
- Besoin de reduire le nombre de requêtes réseau

---

## 2. Setup — @nestjs/graphql + Apollo Server

### 2.1 Installation

```bash
npm install @nestjs/graphql @nestjs/apollo @apollo/server graphql
```

Les packages :
- `@nestjs/graphql` — Module GraphQL pour NestJS
- `@nestjs/apollo` — Driver Apollo Server pour NestJS
- `@apollo/server` — Apollo Server v4
- `graphql` — Implementation de référence de GraphQL en JavaScript

### 2.2 Configuration dans AppModule

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Code-first : le schema est genere automatiquement
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      // Trier les champs par ordre alphabetique
      sortSchema: true,
      // Activer le playground Apollo
      playground: true,
    }),
  ],
})
export class AppModule {}
```

### 2.3 Approche Code-first vs Schema-first

NestJS supporte deux approches pour définir le schema GraphQL :

| Approche | Schema défini dans... | Génération |
|---|---|---|
| **Code-first** | Decorateurs TypeScript | Schema .gql généré automatiquement |
| **Schema-first** | Fichiers .graphql | Types TypeScript generes |

Dans ce module, nous utilisons l'approche **code-first** car elle :
- S'intégré naturellement avec les decorateurs NestJS
- Evite la duplication entre le schema et les types TypeScript
- Permet une meilleure experience avec l'autocompletion

> **Analogie** : L'approche code-first, c'est comme écrire un roman directement. L'approche schema-first, c'est comme écrire d'abord le plan détaillé de chaque chapitre, puis le roman qui doit respecter ce plan. Les deux approches sont valides, mais la première est souvent plus naturelle quand on développé en TypeScript.

### 2.4 Le playground Apollo

Une fois le serveur lance, ouvrez `http://localhost:3000/graphql` dans votre navigateur. Le playground Apollo vous permet de :

- Explorer le schema avec l'onglet **Docs**
- Écrire et exécuter des requêtes
- Voir l'historique des requêtes
- Tester les mutations et subscriptions

```graphql
# Testez cette requete dans le playground
query {
  __schema {
    types {
      name
    }
  }
}
```

C'est l'**introspection** : l'API se decrit elle-même. Très utile en développement, a désactiver en production.

```typescript
// En production, desactivez l'introspection et le playground
GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
  playground: process.env.NODE_ENV !== 'production',
  introspection: process.env.NODE_ENV !== 'production',
}),
```

---

## 3. Code-first — Types et Resolvers

### 3.1 @ObjectType — Définir un type GraphQL

Un `@ObjectType` est l'équivalent GraphQL d'un type dans le schema SDL.

```typescript
// products/models/product.model.ts
import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType({ description: 'Un produit du catalogue' })
export class Product {
  @Field(() => ID, { description: 'Identifiant unique du produit' })
  id: string;

  @Field({ description: 'Nom du produit' })
  name: string;

  @Field({ nullable: true, description: 'Description detaillee' })
  description?: string;

  @Field(() => Float, { description: 'Prix en euros' })
  price: number;

  @Field({ description: 'Date de creation' })
  createdAt: Date;
}
```

Cela généré ce schema SDL :

```graphql
"""Un produit du catalogue"""
type Product {
  """Identifiant unique du produit"""
  id: ID!

  """Nom du produit"""
  name: String!

  """Description detaillee"""
  description: String

  """Prix en euros"""
  price: Float!

  """Date de creation"""
  createdAt: DateTime!
}
```

### 3.2 Types scalaires GraphQL

| GraphQL | TypeScript | Decorateur NestJS |
|---|---|---|
| `ID` | `string \| number` | `@Field(() => ID)` |
| `String` | `string` | `@Field()` |
| `Int` | `number` | `@Field(() => Int)` |
| `Float` | `number` | `@Field(() => Float)` |
| `Boolean` | `boolean` | `@Field()` |
| `DateTime` | `Date` | `@Field()` |

> **Important** : TypeScript ne distingue pas `Int` et `Float` (tout est `number`). Vous devez explicitement spécifier le type GraphQL avec le premier argument de `@Field()`. Si vous ne le faites pas, NestJS infere `Float` par defaut pour les `number`.

### 3.3 Champs nullables et valeurs par defaut

```typescript
@ObjectType()
export class Product {
  // Champ obligatoire (non-null dans le schema GraphQL)
  @Field()
  name: string;

  // Champ optionnel (nullable dans le schema GraphQL)
  @Field({ nullable: true })
  description?: string;

  // Champ avec valeur par defaut
  @Field({ defaultValue: true })
  active: boolean;

  // Liste non-null d'elements non-null : [String!]!
  @Field(() => [String])
  tags: string[];

  // Liste nullable d'elements nullables : [String]
  @Field(() => [String], { nullable: 'itemsAndList' })
  aliases?: (string | null)[] | null;
}
```

### 3.4 @Resolver — Le coeur de la logique

Un resolver est l'équivalent d'un controller REST, mais pour GraphQL.

```typescript
// products/products.resolver.ts
import { Resolver, Query, Args, Mutation, ID } from '@nestjs/graphql';
import { Product } from './models/product.model';
import { ProductsService } from './products.service';
import { CreateProductInput } from './dto/create-product.input';

@Resolver(() => Product)
export class ProductsResolver {
  constructor(private readonly productsService: ProductsService) {}

  // Query : equivalent de GET /products
  @Query(() => [Product], { name: 'products', description: 'Liste tous les produits' })
  findAll(): Product[] {
    return this.productsService.findAll();
  }

  // Query avec argument : equivalent de GET /products/:id
  @Query(() => Product, { name: 'product', nullable: true })
  findOne(@Args('id', { type: () => ID }) id: string): Product | null {
    return this.productsService.findOne(id);
  }

  // Mutation : equivalent de POST /products
  @Mutation(() => Product)
  createProduct(@Args('input') input: CreateProductInput): Product {
    return this.productsService.create(input);
  }
}
```

### 3.5 @Args — Recuperer les arguments

```typescript
// Argument simple
@Query(() => [Product])
products(
  @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
  @Args('offset', { type: () => Int, defaultValue: 0 }) offset: number,
): Product[] {
  return this.productsService.findAll({ limit, offset });
}

// Argument complexe avec @ArgsType
import { ArgsType, Field, Int } from '@nestjs/graphql';
import { Min, Max } from 'class-validator';

@ArgsType()
export class ProductsArgs {
  @Field(() => Int, { defaultValue: 0 })
  @Min(0)
  offset: number;

  @Field(() => Int, { defaultValue: 25 })
  @Min(1)
  @Max(100)
  limit: number;
}

// Utilisation dans le resolver
@Query(() => [Product])
products(@Args() args: ProductsArgs): Product[] {
  return this.productsService.findAll(args);
}
```

### 3.6 @InputType — Donnees en entree

Un `@InputType` est l'équivalent d'un DTO pour les mutations.

```typescript
// products/dto/create-product.input.ts
import { InputType, Field, Float } from '@nestjs/graphql';
import { IsNotEmpty, IsPositive, IsOptional, MaxLength } from 'class-validator';

@InputType({ description: 'Donnees pour creer un produit' })
export class CreateProductInput {
  @Field({ description: 'Nom du produit' })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MaxLength(200)
  name: string;

  @Field({ nullable: true, description: 'Description du produit' })
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @Field(() => Float, { description: 'Prix en euros' })
  @IsPositive({ message: 'Le prix doit etre positif' })
  price: number;
}
```

```typescript
// products/dto/update-product.input.ts
import { InputType, Field, Float, ID, PartialType } from '@nestjs/graphql';
import { CreateProductInput } from './create-product.input';

@InputType()
export class UpdateProductInput extends PartialType(CreateProductInput) {
  @Field(() => ID)
  id: string;
}
```

> **Bonne pratique** : Utilisez `PartialType()` de `@nestjs/graphql` (pas de `@nestjs/mapped-types`) pour les InputTypes partiels. Il rend tous les champs optionnels tout en gardant les decorateurs `@Field`.

### 3.7 Enum GraphQL

```typescript
import { registerEnumType } from '@nestjs/graphql';

export enum ProductStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

registerEnumType(ProductStatus, {
  name: 'ProductStatus',
  description: 'Statut du produit dans le catalogue',
  valuesMap: {
    DRAFT: { description: 'Produit en brouillon, non visible' },
    PUBLISHED: { description: 'Produit publie et visible' },
    ARCHIVED: { description: 'Produit archive, non visible' },
  },
});
```

Utilisation :

```typescript
@ObjectType()
export class Product {
  @Field(() => ProductStatus)
  status: ProductStatus;
}
```

---

## 4. Schema-first — L'approche alternative

### 4.1 Configuration Schema-first

```typescript
// app.module.ts
GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  typePaths: ['./**/*.graphql'],
  definitions: {
    path: join(process.cwd(), 'src/graphql.ts'),
    outputAs: 'class',
  },
}),
```

### 4.2 Fichier .graphql

```graphql
# products/products.graphql
type Product {
  id: ID!
  name: String!
  description: String
  price: Float!
  reviews: [Review!]!
}

type Review {
  id: ID!
  rating: Int!
  comment: String
  productId: ID!
}

input CreateProductInput {
  name: String!
  description: String
  price: Float!
}

type Query {
  products: [Product!]!
  product(id: ID!): Product
}

type Mutation {
  createProduct(input: CreateProductInput!): Product!
  removeProduct(id: ID!): Boolean!
}
```

NestJS généré automatiquement les types TypeScript correspondants dans `src/graphql.ts`.

### 4.3 Resolver Schema-first

```typescript
@Resolver('Product')
export class ProductsResolver {
  constructor(private readonly productsService: ProductsService) {}

  @Query('products')
  findAll() {
    return this.productsService.findAll();
  }

  @Query('product')
  findOne(@Args('id') id: string) {
    return this.productsService.findOne(id);
  }

  @ResolveField('reviews')
  getReviews(@Parent() product: Product) {
    return this.reviewsService.findByProductId(product.id);
  }
}
```

> **Recommandation** : Sauf si votre équipe a déjà un workflow schema-first etabli (par exemple, un schema partage entre plusieurs services), preferez l'approche **code-first** avec NestJS. Elle est mieux intégrée et plus idiomatique.

---

## 5. Resolvers avances — @ResolveField, @Parent, @Context

### 5.1 @ResolveField — Resoudre des champs lies

Quand un champ d'un type fait référence à un autre type, on utilise `@ResolveField` pour indiquer comment le résoudre.

```typescript
// products/models/product.model.ts
@ObjectType()
export class Product {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => Float)
  price: number;

  // Ce champ sera resolu par le resolver, pas par le service
  @Field(() => [Review])
  reviews: Review[];
}
```

```typescript
// products/products.resolver.ts
import { Resolver, Query, ResolveField, Parent } from '@nestjs/graphql';

@Resolver(() => Product)
export class ProductsResolver {
  constructor(
    private readonly productsService: ProductsService,
    private readonly reviewsService: ReviewsService,
  ) {}

  @Query(() => [Product])
  products(): Product[] {
    return this.productsService.findAll();
  }

  // Resout le champ "reviews" pour chaque Product
  @ResolveField(() => [Review])
  reviews(@Parent() product: Product): Review[] {
    return this.reviewsService.findByProductId(product.id);
  }

  // Champ calcule : pas de correspondance directe dans les donnees
  @ResolveField(() => Float)
  averageRating(@Parent() product: Product): number {
    const reviews = this.reviewsService.findByProductId(product.id);
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }
}
```

> **Analogie** : `@ResolveField` est comme un assistant specialise. Quand le resolver principal (le manager) livre un produit, il ne connait pas les avis. Il délégué à un assistant (le ResolveField) qui sait ou trouver les avis pour ce produit spécifique.

### 5.2 @Parent — Acceder au parent

`@Parent()` donne acces a l'objet parent dans l'arbre de résolution.

```typescript
@Resolver(() => Review)
export class ReviewsResolver {
  constructor(private readonly usersService: UsersService) {}

  // Resout le champ "author" pour chaque Review
  @ResolveField(() => User)
  author(@Parent() review: Review): User {
    return this.usersService.findOne(review.authorId);
  }
}
```

Le flux de résolution :

```
Query products
  → ProductsResolver.products()         → retourne [Product]
    → ProductsResolver.reviews(parent)  → pour chaque Product, retourne [Review]
      → ReviewsResolver.author(parent)  → pour chaque Review, retourne User
```

### 5.3 @Context — Acceder au contexte de la requête

Le contexte GraphQL donne acces à la requête HTTP, a l'utilisateur authentifie, etc.

```typescript
// Configuration du contexte
GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: true,
  context: ({ req, res }) => ({ req, res }),
}),
```

```typescript
import { Context } from '@nestjs/graphql';

@Query(() => User)
me(@Context() context: { req: Request }): User {
  // context.req contient la requete HTTP (headers, cookies, etc.)
  const userId = context.req.user?.id;
  return this.usersService.findOne(userId);
}
```

---

## 6. Le problème N+1 et DataLoader

### 6.1 Le problème N+1 explique

C'est le piege classique de GraphQL. Observons cette requête :

```graphql
query {
  products {     # 1 requete pour charger 50 produits
    name
    reviews {    # 50 requetes supplementaires (1 par produit)
      rating
    }
  }
}
```

Résultat : **1 + 50 = 51 requêtes** à la base de donnees. C'est le problème **N+1**.

Avec REST, le problème existe aussi, mais il est géré cote serveur (eager loading, joins). Avec GraphQL, le client peut demander n'importe quelle combinaison de champs, donc le problème est plus frequent.

> **Analogie** : Imagine un professeur qui doit distribuer les copies a 30 eleves. Le problème N+1, c'est comme faire un aller-retour au casier pour chaque copie. La solution DataLoader, c'est comme aller au casier une seule fois et ramener toutes les copies d'un coup.

### 6.2 DataLoader — La solution

**DataLoader** est une bibliotheque qui regroupe (batch) et met en cache les requêtes pendant un même tick d'exécution.

```bash
npm install dataloader
```

```typescript
// products/products.dataloader.ts
import * as DataLoader from 'dataloader';
import { Injectable, Scope } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { Review } from './models/review.model';

@Injectable({ scope: Scope.REQUEST })
export class ReviewsLoader {
  constructor(private readonly reviewsService: ReviewsService) {}

  // Le DataLoader regroupe tous les IDs demandes pendant un tick
  // et fait UN SEUL appel a la base de donnees
  public readonly batchReviews = new DataLoader<string, Review[]>(
    async (productIds: readonly string[]) => {
      // Une seule requete pour tous les produits
      const reviews = await this.reviewsService.findByProductIds([...productIds]);

      // Reorganiser les resultats par productId
      const reviewsMap = new Map<string, Review[]>();
      for (const review of reviews) {
        const existing = reviewsMap.get(review.productId) || [];
        existing.push(review);
        reviewsMap.set(review.productId, existing);
      }

      // Retourner dans le meme ordre que les IDs demandes
      return productIds.map((id) => reviewsMap.get(id) || []);
    },
  );
}
```

### 6.3 Utilisation du DataLoader dans le Resolver

```typescript
@Resolver(() => Product)
export class ProductsResolver {
  constructor(
    private readonly productsService: ProductsService,
    private readonly reviewsLoader: ReviewsLoader,
  ) {}

  @Query(() => [Product])
  products(): Product[] {
    return this.productsService.findAll();
  }

  @ResolveField(() => [Review])
  reviews(@Parent() product: Product): Promise<Review[]> {
    // Au lieu d'appeler directement le service,
    // on delegue au DataLoader qui va regrouper les appels
    return this.reviewsLoader.batchReviews.load(product.id);
  }
}
```

**Avant DataLoader** : 1 + N requêtes (51 pour 50 produits)
**Après DataLoader** : 1 + 1 = 2 requêtes (une pour les produits, une pour toutes les reviews)

### 6.4 Scope REQUEST — Pourquoi c'est important

Le DataLoader doit etre en scope `REQUEST` pour deux raisons :

1. **Cache par requête** : Chaque requête GraphQL a son propre cache. Sinon, un utilisateur pourrait voir des donnees cachees d'un autre utilisateur.
2. **Batching par tick** : Le regroupement se fait pendant un seul tick d'exécution, qui correspond à une seule requête.

```typescript
@Injectable({ scope: Scope.REQUEST })
export class ReviewsLoader {
  // Cree un nouveau DataLoader pour chaque requete HTTP
}
```

> **Attention** : Les providers en scope `REQUEST` impactent la performance car ils sont recrees à chaque requête. Utilisez-les uniquement pour les DataLoaders, pas pour les services classiques.

---

## 7. Mutations et validation

### 7.1 Mutations CRUD completes

```typescript
@Resolver(() => Product)
export class ProductsResolver {
  constructor(private readonly productsService: ProductsService) {}

  @Mutation(() => Product, { description: 'Creer un nouveau produit' })
  createProduct(
    @Args('input') input: CreateProductInput,
  ): Product {
    return this.productsService.create(input);
  }

  @Mutation(() => Product, { description: 'Modifier un produit existant' })
  updateProduct(
    @Args('input') input: UpdateProductInput,
  ): Product {
    return this.productsService.update(input.id, input);
  }

  @Mutation(() => Boolean, { description: 'Supprimer un produit' })
  removeProduct(
    @Args('id', { type: () => ID }) id: string,
  ): boolean {
    return this.productsService.remove(id);
  }
}
```

### 7.2 Validation avec class-validator

La validation fonctionne exactement comme en REST, grace au `ValidationPipe` global.

```typescript
// main.ts
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,       // Supprime les champs non declares
    forbidNonWhitelisted: true,  // Erreur si champ inconnu
    transform: true,       // Transforme les types automatiquement
  }));
  await app.listen(3000);
}
```

```typescript
// dto/create-product.input.ts
@InputType()
export class CreateProductInput {
  @Field()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @Field(() => Float)
  @IsPositive()
  @Max(99999.99)
  price: number;
}
```

Les erreurs de validation sont automatiquement formatees par NestJS :

```json
{
  "errors": [
    {
      "message": "Bad Request Exception",
      "extensions": {
        "code": "BAD_USER_INPUT",
        "response": {
          "statusCode": 400,
          "message": [
            "name must be longer than or equal to 2 characters",
            "price must be a positive number"
          ]
        }
      }
    }
  ]
}
```

### 7.3 Gestion des erreurs personnalisees

```typescript
import { NotFoundException } from '@nestjs/common';

@Query(() => Product)
product(@Args('id', { type: () => ID }) id: string): Product {
  const product = this.productsService.findOne(id);
  if (!product) {
    throw new NotFoundException(`Produit avec l'id ${id} non trouve`);
  }
  return product;
}
```

NestJS convertit automatiquement les exceptions HTTP en erreurs GraphQL.

Pour des erreurs GraphQL personnalisees :

```typescript
import { GraphQLError } from 'graphql';

throw new GraphQLError('Produit non trouve', {
  extensions: {
    code: 'PRODUCT_NOT_FOUND',
    productId: id,
  },
});
```

---

## 8. Subscriptions — Temps réel

### 8.1 Configuration

Les subscriptions utilisent les WebSockets pour envoyer des donnees en temps réel au client.

```bash
npm install graphql-subscriptions
```

```typescript
// app.module.ts
GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: true,
  subscriptions: {
    'graphql-ws': true,    // Protocole moderne (recommande)
    'subscriptions-transport-ws': false,  // Ancien protocole (deprecie)
  },
}),
```

### 8.2 PubSub — Le système de publication

```typescript
// common/pubsub.provider.ts
import { PubSub } from 'graphql-subscriptions';

// En production, utilisez une implementation Redis
// (graphql-redis-subscriptions) pour supporter plusieurs instances
export const pubSub = new PubSub();
```

> **Attention** : `PubSub` de `graphql-subscriptions` est **uniquement pour le développement**. En production avec plusieurs instances du serveur, utilisez `graphql-redis-subscriptions` ou `graphql-kafka-subscriptions` pour que les messages soient distribues entre toutes les instances.

### 8.3 Publication dans les mutations

```typescript
import { pubSub } from '../common/pubsub.provider';

@Mutation(() => Product)
async createProduct(
  @Args('input') input: CreateProductInput,
): Promise<Product> {
  const product = this.productsService.create(input);

  // Publier l'evenement
  pubSub.publish('productCreated', { productCreated: product });

  return product;
}
```

### 8.4 @Subscription — Ecouter les événements

```typescript
import { Resolver, Subscription } from '@nestjs/graphql';
import { pubSub } from '../common/pubsub.provider';

@Resolver(() => Product)
export class ProductsResolver {
  @Subscription(() => Product, {
    description: 'Ecoute les nouveaux produits crees',
  })
  productCreated() {
    return pubSub.asyncIterableIterator('productCreated');
  }

  // Subscription avec filtre
  @Subscription(() => Product, {
    filter: (payload, variables) => {
      // Ne notifier que si le prix depasse le seuil demande
      return payload.productCreated.price >= variables.minPrice;
    },
  })
  productCreated(
    @Args('minPrice', { type: () => Float, defaultValue: 0 }) _minPrice: number,
  ) {
    return pubSub.asyncIterableIterator('productCreated');
  }
}
```

### 8.5 Cote client — Ecouter une subscription

```graphql
subscription {
  productCreated {
    id
    name
    price
  }
}
```

Dans Apollo Client (React) :

```typescript
import { useSubscription, gql } from '@apollo/client';

const PRODUCT_CREATED = gql`
  subscription OnProductCreated {
    productCreated {
      id
      name
      price
    }
  }
`;

function ProductFeed() {
  const { data, loading } = useSubscription(PRODUCT_CREATED);

  if (loading) return <p>En attente de nouveaux produits...</p>;
  return <p>Nouveau produit : {data.productCreated.name}</p>;
}
```

---

## 9. Authentification et sécurité

### 9.1 Guards avec GraphQL

Les guards NestJS fonctionnent avec GraphQL, mais il faut adapter l'extraction du contexte.

```typescript
// auth/gql-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  // Override pour extraire la requete HTTP du contexte GraphQL
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}
```

Utilisation :

```typescript
@Resolver(() => Product)
export class ProductsResolver {
  // Query publique
  @Query(() => [Product])
  products(): Product[] {
    return this.productsService.findAll();
  }

  // Mutation protegee
  @UseGuards(GqlAuthGuard)
  @Mutation(() => Product)
  createProduct(
    @Args('input') input: CreateProductInput,
    @Context() context: any,
  ): Product {
    const userId = context.req.user.id;
    return this.productsService.create(input, userId);
  }
}
```

### 9.2 Decorateur @CurrentUser personnalise

```typescript
// auth/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);
```

```typescript
@UseGuards(GqlAuthGuard)
@Mutation(() => Product)
createProduct(
  @Args('input') input: CreateProductInput,
  @CurrentUser() user: User,
): Product {
  return this.productsService.create(input, user.id);
}
```

### 9.3 Limitation de profondeur (Depth limiting)

Sans protection, un client malveillant pourrait envoyer une requête très imbriquee :

```graphql
query {
  products {
    reviews {
      author {
        products {
          reviews {
            author {
              products { ... }
            }
          }
        }
      }
    }
  }
}
```

Cette requête pourrait mettre le serveur a genoux.

```bash
npm install graphql-depth-limit
```

```typescript
import depthLimit from 'graphql-depth-limit';

GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: true,
  validationRules: [depthLimit(5)],
}),
```

### 9.4 Limitation de complexite (Query complexity)

La profondeur ne suffit pas. Une requête peu profonde mais avec beaucoup de champs peut aussi etre couteuse.

```bash
npm install graphql-query-complexity
```

```typescript
import {
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from 'graphql-query-complexity';

GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: true,
  plugins: [
    {
      async requestDidStart() {
        return {
          async didResolveOperation({ request, document, schema }) {
            const complexity = getComplexity({
              schema,
              operationName: request.operationName,
              query: document,
              variables: request.variables,
              estimators: [
                fieldExtensionsEstimator(),
                simpleEstimator({ defaultComplexity: 1 }),
              ],
            });

            if (complexity > 50) {
              throw new GraphQLError(
                `Requete trop complexe : ${complexity}. Maximum autorise : 50.`,
              );
            }
          },
        };
      },
    },
  ],
}),
```

Définir la complexite par champ :

```typescript
@ObjectType()
export class Product {
  @Field()
  name: string;

  // Ce champ est couteux a resoudre
  @Field(() => [Review], { complexity: 10 })
  reviews: Review[];
}
```

### 9.5 Rate limiting

```typescript
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    return { req: ctx.req, res: ctx.res };
  }
}
```

### 9.6 Checklist sécurité GraphQL

| Mesure | Importance | Implementation |
|---|---|---|
| Desactiver l'introspection en prod | Critique | `introspection: false` |
| Limiter la profondeur | Critique | `graphql-depth-limit` |
| Limiter la complexite | Eleve | `graphql-query-complexity` |
| Rate limiting | Eleve | `@nestjs/throttler` avec `GqlThrottlerGuard` |
| Auth sur les mutations | Critique | `GqlAuthGuard` |
| Validation des inputs | Critique | `class-validator` + `ValidationPipe` |
| Desactiver le playground en prod | Eleve | `playground: false` |
| CORS | Eleve | Configuration NestJS standard |

---

## 10. Pagination — Cursor-based (Relay)

### 10.1 Pourquoi la pagination cursor-based ?

| Pagination | Avantages | Inconvenients |
|---|---|---|
| **Offset/Limit** | Simple, familier | Donnees dupliquees ou manquantes si les donnees changent |
| **Cursor-based** | Stable, performant | Plus complexe a implementer |

La pagination cursor-based utilise un **curseur opaque** (généralement un ID encode en base64) pour indiquer où reprendre la lecture.

### 10.2 Types de pagination Relay

Le standard Relay définit une structure de pagination reuilisable :

```typescript
// common/pagination/page-info.model.ts
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class PageInfo {
  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;

  @Field({ nullable: true })
  startCursor?: string;

  @Field({ nullable: true })
  endCursor?: string;
}
```

```typescript
// common/pagination/paginated.type.ts
import { Type } from '@nestjs/common';
import { ObjectType, Field, Int } from '@nestjs/graphql';
import { PageInfo } from './page-info.model';

// Factory generique pour creer des types pagines
export function Paginated<T>(classRef: Type<T>): any {
  @ObjectType(`${classRef.name}Edge`)
  abstract class EdgeType {
    @Field(() => String)
    cursor: string;

    @Field(() => classRef)
    node: T;
  }

  @ObjectType({ isAbstract: true })
  abstract class PaginatedType {
    @Field(() => [EdgeType])
    edges: EdgeType[];

    @Field(() => PageInfo)
    pageInfo: PageInfo;

    @Field(() => Int)
    totalCount: number;
  }

  return PaginatedType;
}
```

### 10.3 Utilisation

```typescript
// products/models/paginated-products.model.ts
import { ObjectType } from '@nestjs/graphql';
import { Paginated } from '../../common/pagination/paginated.type';
import { Product } from './product.model';

@ObjectType()
export class PaginatedProducts extends Paginated(Product) {}
```

```typescript
// products/products.resolver.ts
@Query(() => PaginatedProducts)
products(
  @Args('first', { type: () => Int, defaultValue: 10 }) first: number,
  @Args('after', { nullable: true }) after?: string,
): PaginatedProducts {
  return this.productsService.findPaginated(first, after);
}
```

```typescript
// products/products.service.ts
findPaginated(first: number, after?: string): PaginatedProducts {
  let startIndex = 0;

  if (after) {
    // Decoder le curseur (base64 de l'ID)
    const decodedCursor = Buffer.from(after, 'base64').toString('utf-8');
    const afterIndex = this.products.findIndex((p) => p.id === decodedCursor);
    if (afterIndex >= 0) startIndex = afterIndex + 1;
  }

  const slice = this.products.slice(startIndex, startIndex + first);

  const edges = slice.map((product) => ({
    cursor: Buffer.from(product.id).toString('base64'),
    node: product,
  }));

  return {
    edges,
    pageInfo: {
      hasNextPage: startIndex + first < this.products.length,
      hasPreviousPage: startIndex > 0,
      startCursor: edges[0]?.cursor,
      endCursor: edges[edges.length - 1]?.cursor,
    },
    totalCount: this.products.length,
  };
}
```

Requête cote client :

```graphql
query {
  products(first: 5) {
    edges {
      cursor
      node {
        id
        name
        price
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}

# Page suivante
query {
  products(first: 5, after: "cHJvZHVjdC0z") {
    edges {
      cursor
      node {
        id
        name
        price
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

---

## 11. Testing GraphQL APIs

### 11.1 Tests E2E avec supertest

Pour tester une API GraphQL, on envoie des requêtes POST au endpoint `/graphql`.

```typescript
// test/products.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Products GraphQL (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return all products', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query {
            products {
              id
              name
              price
            }
          }
        `,
      })
      .expect(200);

    expect(res.body.data.products).toBeDefined();
    expect(Array.isArray(res.body.data.products)).toBe(true);
  });

  it('should create a product', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            createProduct(input: {
              name: "Test Product"
              price: 29.99
            }) {
              id
              name
              price
            }
          }
        `,
      })
      .expect(200);

    expect(res.body.data.createProduct.name).toBe('Test Product');
    expect(res.body.data.createProduct.price).toBe(29.99);
  });
});
```

### 11.2 Tests unitaires d'un Resolver

```typescript
// products/products.resolver.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsResolver } from './products.resolver';
import { ProductsService } from './products.service';

describe('ProductsResolver', () => {
  let resolver: ProductsResolver;
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsResolver,
        {
          provide: ProductsService,
          useValue: {
            findAll: jest.fn().mockReturnValue([
              { id: '1', name: 'Product 1', price: 10 },
            ]),
            findOne: jest.fn().mockReturnValue(
              { id: '1', name: 'Product 1', price: 10 },
            ),
            create: jest.fn().mockImplementation((input) => ({
              id: '2',
              ...input,
              createdAt: new Date(),
            })),
          },
        },
      ],
    }).compile();

    resolver = module.get<ProductsResolver>(ProductsResolver);
    service = module.get<ProductsService>(ProductsService);
  });

  it('should return all products', () => {
    const result = resolver.findAll();
    expect(result).toHaveLength(1);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('should create a product', () => {
    const input = { name: 'New Product', price: 25.99 };
    const result = resolver.createProduct(input as any);
    expect(result.name).toBe('New Product');
    expect(service.create).toHaveBeenCalledWith(input);
  });
});
```

### 11.3 Tester les erreurs

```typescript
it('should return errors for invalid input', async () => {
  const res = await request(app.getHttpServer())
    .post('/graphql')
    .send({
      query: `
        mutation {
          createProduct(input: {
            name: ""
            price: -5
          }) {
            id
          }
        }
      `,
    })
    .expect(200);

  // GraphQL retourne toujours 200, les erreurs sont dans le body
  expect(res.body.errors).toBeDefined();
});

it('should return null for non-existent product', async () => {
  const res = await request(app.getHttpServer())
    .post('/graphql')
    .send({
      query: `
        query {
          product(id: "non-existent") {
            id
            name
          }
        }
      `,
    })
    .expect(200);

  expect(res.body.data.product).toBeNull();
});
```

---

## 12. Apollo Client — Vue d'ensemble

### 12.1 Installation (React)

```bash
npm install @apollo/client graphql
```

### 12.2 Configuration

```typescript
// apollo-client.ts
import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';

const httpLink = new HttpLink({
  uri: 'http://localhost:3000/graphql',
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: 'ws://localhost:3000/graphql',
  }),
);

// Routage : WebSocket pour les subscriptions, HTTP pour le reste
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink,
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
```

### 12.3 useQuery — Lire des donnees

```typescript
import { useQuery, gql } from '@apollo/client';

const GET_PRODUCTS = gql`
  query GetProducts {
    products {
      id
      name
      price
      reviews {
        rating
      }
    }
  }
`;

function ProductsList() {
  const { loading, error, data, refetch } = useQuery(GET_PRODUCTS);

  if (loading) return <p>Chargement...</p>;
  if (error) return <p>Erreur : {error.message}</p>;

  return (
    <ul>
      {data.products.map((product) => (
        <li key={product.id}>
          {product.name} — {product.price} euros
        </li>
      ))}
    </ul>
  );
}
```

### 12.4 useMutation — Modifier des donnees

```typescript
import { useMutation, gql } from '@apollo/client';

const CREATE_PRODUCT = gql`
  mutation CreateProduct($input: CreateProductInput!) {
    createProduct(input: $input) {
      id
      name
      price
    }
  }
`;

function CreateProductForm() {
  const [createProduct, { loading, error }] = useMutation(CREATE_PRODUCT, {
    // Mettre a jour le cache apres la mutation
    refetchQueries: ['GetProducts'],
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createProduct({
      variables: {
        input: {
          name: 'Nouveau produit',
          price: 49.99,
        },
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... champs du formulaire ... */}
      <button type="submit" disabled={loading}>
        {loading ? 'Creation...' : 'Creer'}
      </button>
      {error && <p>Erreur : {error.message}</p>}
    </form>
  );
}
```

### 12.5 Cache et mise a jour optimiste

```typescript
const [createProduct] = useMutation(CREATE_PRODUCT, {
  // Mise a jour optimiste : le UI est mis a jour avant la reponse du serveur
  optimisticResponse: {
    createProduct: {
      __typename: 'Product',
      id: 'temp-id',
      name: 'Nouveau produit',
      price: 49.99,
    },
  },
  // Mettre a jour manuellement le cache
  update(cache, { data: { createProduct } }) {
    cache.modify({
      fields: {
        products(existingProducts = []) {
          const newProductRef = cache.writeFragment({
            data: createProduct,
            fragment: gql`
              fragment NewProduct on Product {
                id
                name
                price
              }
            `,
          });
          return [...existingProducts, newProductRef];
        },
      },
    });
  },
});
```

---

## 13. Patterns avances

### 13.1 Federation — Microservices GraphQL

Quand votre application est decomposee en microservices, Apollo Federation permet de combiner plusieurs sous-graphes en un seul schema unifie.

```
Client → Apollo Gateway → Service Produits (sous-graphe)
                        → Service Utilisateurs (sous-graphe)
                        → Service Commandes (sous-graphe)
```

Chaque service définit sa portion du schema, et le Gateway les combine automatiquement.

```typescript
// Installation pour un sous-graphe
npm install @apollo/subgraph

// Configuration NestJS
GraphQLModule.forRoot<ApolloFederationDriverConfig>({
  driver: ApolloFederationDriver,
  autoSchemaFile: { federation: 2 },
}),
```

### 13.2 Directives personnalisees

```typescript
import { SchemaDirectiveVisitor } from '@graphql-tools/utils';

// Directive @upper qui met en majuscules
@Directive('@upper')
@ObjectType()
export class Product {
  @Field()
  name: string; // Sera automatiquement en majuscules
}
```

### 13.3 Interceptors GraphQL

```typescript
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        console.log(
          `${info.parentType.name}.${info.fieldName} — ${Date.now() - now}ms`,
        );
      }),
    );
  }
}
```

### 13.4 Scalaires personnalises

```typescript
import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

@Scalar('Date', () => Date)
export class DateScalar implements CustomScalar<string, Date> {
  description = 'Date custom scalar type (ISO 8601)';

  parseValue(value: string): Date {
    return new Date(value);
  }

  serialize(value: Date): string {
    return value.toISOString();
  }

  parseLiteral(ast: ValueNode): Date {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  }
}
```

---

## 14. Récapitulatif et bonnes pratiques

### 14.1 Architecture d'un module GraphQL NestJS

```
src/
├── app.module.ts                 # GraphQLModule.forRoot
├── common/
│   ├── pagination/
│   │   ├── page-info.model.ts
│   │   └── paginated.type.ts
│   └── pubsub.provider.ts
├── products/
│   ├── dto/
│   │   ├── create-product.input.ts
│   │   └── update-product.input.ts
│   ├── models/
│   │   ├── product.model.ts
│   │   └── paginated-products.model.ts
│   ├── products.dataloader.ts
│   ├── products.module.ts
│   ├── products.resolver.ts
│   ├── products.resolver.spec.ts
│   └── products.service.ts
└── schema.gql                    # Genere automatiquement
```

### 14.2 Checklist avant mise en production

| Élément | Description |
|---|---|
| Desactiver le playground | `playground: false` en production |
| Desactiver l'introspection | `introspection: false` en production |
| Limiter la profondeur | `graphql-depth-limit` (max 5-7 niveaux) |
| Limiter la complexite | `graphql-query-complexity` (max 50-100) |
| DataLoaders | Pour toutes les relations N+1 |
| Validation des inputs | `class-validator` sur tous les `@InputType` |
| Auth sur les mutations | `@UseGuards(GqlAuthGuard)` |
| Rate limiting | `@nestjs/throttler` adapte pour GraphQL |
| Logs et monitoring | `LoggingInterceptor` ou Apollo Studio |
| Persisted queries | Limiter les requêtes aux requêtes connues |

### 14.3 Comparaison finale REST vs GraphQL

```
REST                          GraphQL
────────────────────          ────────────────────
GET  /products                query { products { ... } }
GET  /products/42             query { product(id: 42) { ... } }
POST /products                mutation { createProduct(input: {...}) { ... } }
PUT  /products/42             mutation { updateProduct(input: {...}) { ... } }
DELETE /products/42           mutation { removeProduct(id: 42) }
WebSocket /ws                 subscription { productCreated { ... } }
```

**Les deux approches ne sont pas mutuellement exclusives.** Beaucoup d'applications utilisent REST pour les operations simples et GraphQL pour les ecrans complexes qui necessitent des donnees de plusieurs sources.

---

## 15. Exercices

### Exercice 1 — Premier schema
Creez un schema GraphQL code-first pour une application de gestion de livres avec :
- `Book` (id, title, author, year, genre)
- `Author` (id, name, birthYear)
- Queries : `books`, `book(id)`, `booksByAuthor(authorId)`
- Mutations : `createBook`, `updateBook`, `removeBook`

### Exercice 2 — DataLoader
Identifiez le problème N+1 dans cette requête et implementez un DataLoader :
```graphql
query {
  books {
    title
    author {
      name
      books {
        title
      }
    }
  }
}
```

### Exercice 3 — Pagination
Implementez la pagination cursor-based (Relay) pour la query `books`.

### Exercice 4 — Sécurité
Ajoutez un guard d'authentification sur les mutations, la limitation de profondeur a 4, et la complexite maximale a 30.

---

## 16. Ressources

- [Documentation NestJS — GraphQL](https://docs.nestjs.com/graphql/quick-start)
- [Apollo Server Documentation](https://www.apollographql.com/docs/apollo-server/)
- [GraphQL Specification](https://spec.graphql.org/)
- [How to GraphQL](https://www.howtographql.com/) — Tutoriel interactif
- [DataLoader GitHub](https://github.com/graphql/dataloader)
- [Relay Cursor Connections Specification](https://relay.dev/graphql/connections.htm)
- [GraphQL Security — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html)

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 26 graphql](../screencasts/screencast-26-graphql.md)
2. **Lab** : [lab-26-graphql](../labs/lab-26-graphql/README)
3. **Quiz** : [quiz 26 graphql](../quizzes/quiz-26-graphql.html)
:::

---

<!-- navigation-inter-cours -->

::: info Cours suivant
Bravo, tu as termine le cours **NestJS** ! 
Le prochain cours du curriculum est **PostgreSQL**.

[Commencer PostgreSQL →](../../06-postgresql/modules/00-prerequis-et-vue-ensemble.md)
:::
