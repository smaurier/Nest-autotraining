# Module 17 — Prisma — Requetes avancees & Comparaison TypeORM vs Prisma

> **Objectif** : Maîtriser les requêtes avancees de Prisma (ecritures imbriquees, filtrage complexe, transactions, SQL brut) et comparer objectivement TypeORM et Prisma pour faire un choix eclaire.
> **Difficulte** : ⭐⭐⭐ (avance)
> **Prérequis** : Module 14 (TypeORM Entites), Module 15 (TypeORM Requetes), Module 16 (Prisma Schema & Client)
> **Duree estimee** : 5 heures

---

## 1. Ecritures imbriquees (Nested Writes)

### 1.1 Créer avec des relations

Prisma permet de créer des enregistrements et leurs relations en une seule operation.

```typescript
// Creer un utilisateur avec son profil et un premier article
const user = await prisma.user.create({
  data: {
    email: 'alice@example.com',
    nom: 'Alice Dupont',
    motDePasse: 'hashSecurise',

    // Creer le profil en meme temps (One-to-One)
    profile: {
      create: {
        bio: 'Developpeuse full-stack passionee par NestJS',
        avatar: '/uploads/alice.jpg',
        twitter: '@alice_dev',
      },
    },

    // Creer des articles en meme temps (One-to-Many)
    articles: {
      create: [
        {
          titre: 'Mon premier article',
          slug: 'mon-premier-article',
          contenu: 'Contenu de mon premier article...',
          statut: 'PUBLIE',
        },
        {
          titre: 'Deuxieme article',
          slug: 'deuxieme-article',
          contenu: 'Contenu du deuxieme article...',
          statut: 'BROUILLON',
        },
      ],
    },
  },
  include: {
    profile: true,
    articles: true,
  },
});
```

### 1.2 connect — Lier à un enregistrement existant

```typescript
// Creer un article lie a un utilisateur existant
const article = await prisma.article.create({
  data: {
    titre: 'Nouvel article',
    slug: 'nouvel-article',
    contenu: 'Contenu...',

    // Lier a un utilisateur existant par son ID
    auteur: {
      connect: { id: 1 },
    },

    // Lier a des tags existants (Many-to-Many)
    tags: {
      connect: [
        { id: 1 },    // Tag #1
        { id: 3 },    // Tag #3
        { nom: 'NestJS' },  // Ou par un champ unique
      ],
    },
  },
});
```

### 1.3 connectOrCreate — Lier ou créer

```typescript
// Creer un article avec des tags : les creer s'ils n'existent pas
const article = await prisma.article.create({
  data: {
    titre: 'Guide TypeScript',
    slug: 'guide-typescript',
    contenu: 'Contenu complet...',
    auteurId: 1,

    tags: {
      connectOrCreate: [
        {
          where: { nom: 'TypeScript' },        // Cherche par nom
          create: { nom: 'TypeScript', couleur: '#3178C6' },  // Cree si absent
        },
        {
          where: { nom: 'JavaScript' },
          create: { nom: 'JavaScript', couleur: '#F7DF1E' },
        },
      ],
    },
  },
  include: { tags: true },
});
```

> **Bonne pratique** : `connectOrCreate` est très utile pour les tags, categories et autres entites de référence. Il evite de faire un `findUnique` suivi d'un `create` conditionnel.

### 1.4 Mise a jour des relations

```typescript
// Mettre a jour les tags d'un article

// set — remplacer TOUS les tags par une nouvelle liste
const article = await prisma.article.update({
  where: { id: 1 },
  data: {
    tags: {
      set: [{ id: 2 }, { id: 5 }],  // Remplace tous les tags
    },
  },
});

// connect — ajouter un tag supplementaire
const article = await prisma.article.update({
  where: { id: 1 },
  data: {
    tags: {
      connect: { id: 3 },  // Ajoute le tag #3
    },
  },
});

// disconnect — retirer un tag
const article = await prisma.article.update({
  where: { id: 1 },
  data: {
    tags: {
      disconnect: { id: 2 },  // Retire le tag #2
    },
  },
});

// Mise a jour imbriquee d'un One-to-One
const user = await prisma.user.update({
  where: { id: 1 },
  data: {
    nom: 'Alice Martin',
    profile: {
      update: {  // Met a jour le profil existant
        bio: 'Nouvelle bio mise a jour',
      },
    },
  },
});

// upsert imbrique — creer le profil s'il n'existe pas, le mettre a jour sinon
const user = await prisma.user.update({
  where: { id: 1 },
  data: {
    profile: {
      upsert: {
        create: { bio: 'Nouveau profil' },
        update: { bio: 'Profil mis a jour' },
      },
    },
  },
});
```

> **Piege classique** : `set` sur une relation Many-to-Many **remplace** tous les liens existants. Si vous voulez seulement **ajouter** un lien, utilisez `connect`. Si vous voulez **retirer** un lien, utilisez `disconnect`.

---

## 2. include vs select — Stratégies de chargement

### 2.1 include — Charger les relations

`include` charge les relations en plus de tous les champs du modèle principal.

```typescript
// Charge l'article avec TOUS ses champs + les relations specifiees
const article = await prisma.article.findUnique({
  where: { id: 1 },
  include: {
    auteur: true,           // Charge tous les champs de l'auteur
    tags: true,              // Charge tous les tags
    commentaires: {
      include: {
        auteur: true,        // Charge l'auteur de chaque commentaire
      },
      orderBy: { createdAt: 'desc' },
      take: 10,              // Limite a 10 commentaires
    },
    _count: {                // Comptage des relations
      select: {
        commentaires: true,  // Nombre de commentaires
      },
    },
  },
});
// article.titre ✓ (tous les champs)
// article.auteur.nom ✓
// article.commentaires[0].auteur.nom ✓
// article._count.commentaires = 42
```

### 2.2 select — Selectionner des champs spécifiques

`select` permet de choisir exactement quels champs retourner. C'est une **optimisation importante** pour éviter de charger des donnees inutiles.

```typescript
// Ne charge QUE les champs specifies
const article = await prisma.article.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    titre: true,
    slug: true,
    createdAt: true,
    // contenu: false (implicitement exclu)

    auteur: {
      select: {
        id: true,
        nom: true,
        // email, motDePasse etc. ne sont PAS charges
      },
    },

    tags: {
      select: {
        id: true,
        nom: true,
        couleur: true,
      },
    },

    _count: {
      select: { commentaires: true },
    },
  },
});
// article.titre ✓
// article.contenu ✗ (non selectionne → undefined)
// article.auteur.nom ✓
// article.auteur.email ✗ (non selectionne)
```

> **A retenir** : `include` et `select` sont **mutuellement exclusifs** au même niveau. Vous ne pouvez pas utiliser les deux en même temps sur le même objet. `include` charge TOUT + les relations. `select` ne charge QUE ce que vous demandez.

### 2.3 Tableau comparatif

| Critere | `include` | `select` |
|---------|-----------|----------|
| Champs du modèle | Tous | Seulement ceux specifies |
| Relations | Ajoutees aux champs existants | Doivent etre explicitement demandees |
| Performance | Peut charger trop de donnees | Optimise le transfert |
| Cas d'usage | Quand on veut tout + relations | API publiques, listes, performances |

---

## 3. Filtrage et tri avances

### 3.1 Operateurs de filtrage

```typescript
// Tous les operateurs de filtrage disponibles
const articles = await prisma.article.findMany({
  where: {
    // Egalite (implicite)
    statut: 'PUBLIE',

    // Comparaisons numeriques
    nombreVues: {
      gt: 100,      // Greater than (>)
      gte: 100,     // Greater than or equal (>=)
      lt: 1000,     // Less than (<)
      lte: 1000,    // Less than or equal (<=)
    },

    // Recherche textuelle
    titre: {
      contains: 'NestJS',       // LIKE '%NestJS%'
      startsWith: 'Guide',      // LIKE 'Guide%'
      endsWith: 'avance',       // LIKE '%avance'
      // Mode insensible a la casse (PostgreSQL)
      mode: 'insensitive',
    },

    // Inclusion dans une liste
    auteurId: {
      in: [1, 2, 3],            // IN (1, 2, 3)
      notIn: [4, 5],            // NOT IN (4, 5)
    },

    // Negation
    slug: {
      not: 'brouillon',         // != 'brouillon'
    },

    // Null check
    resume: {
      not: null,                 // IS NOT NULL
    },
    // Equivalent plus court :
    // resume: { not: null }

    // Dates
    createdAt: {
      gte: new Date('2024-01-01'),
      lt: new Date('2025-01-01'),
    },
  },
});
```

### 3.2 Operateurs logiques AND, OR, NOT

```typescript
// Operateur OR
const articles = await prisma.article.findMany({
  where: {
    OR: [
      { titre: { contains: 'NestJS', mode: 'insensitive' } },
      { contenu: { contains: 'NestJS', mode: 'insensitive' } },
      { tags: { some: { nom: 'NestJS' } } },
    ],
  },
});

// Operateur AND (implicite par defaut, mais peut etre explicite)
const articles = await prisma.article.findMany({
  where: {
    AND: [
      { statut: 'PUBLIE' },
      { nombreVues: { gte: 100 } },
      { auteurId: 1 },
    ],
  },
});

// Operateur NOT
const articles = await prisma.article.findMany({
  where: {
    NOT: {
      statut: 'ARCHIVE',
    },
  },
});

// Combinaison complexe
const articles = await prisma.article.findMany({
  where: {
    statut: 'PUBLIE',
    AND: [
      {
        OR: [
          { titre: { contains: 'TypeScript', mode: 'insensitive' } },
          { titre: { contains: 'NestJS', mode: 'insensitive' } },
        ],
      },
      { nombreVues: { gte: 50 } },
    ],
    NOT: {
      auteurId: { in: [10, 11, 12] }, // Exclure certains auteurs
    },
  },
});
```

### 3.3 Filtrage sur les relations

```typescript
// Articles qui ONT au moins un tag "NestJS"
const articles = await prisma.article.findMany({
  where: {
    tags: {
      some: { nom: 'NestJS' },  // Au moins un tag matche
    },
  },
});

// Articles dont TOUS les commentaires sont recents
const articles = await prisma.article.findMany({
  where: {
    commentaires: {
      every: {
        createdAt: { gte: new Date('2024-01-01') },
      },
    },
  },
});

// Articles SANS commentaires
const articles = await prisma.article.findMany({
  where: {
    commentaires: {
      none: {},  // Aucun commentaire
    },
  },
});

// Utilisateurs dont au moins un article est publie
const users = await prisma.user.findMany({
  where: {
    articles: {
      some: { statut: 'PUBLIE' },
    },
  },
});
```

| Operateur relation | Description |
|-------------------|-------------|
| `some` | Au moins un enregistrement relie matche |
| `every` | Tous les enregistrements relies matchent |
| `none` | Aucun enregistrement relie ne matche |
| `is` | L'enregistrement relie (singulier) matche |
| `isNot` | L'enregistrement relie (singulier) ne matche pas |

### 3.4 Tri avance

```typescript
// Tri simple
const articles = await prisma.article.findMany({
  orderBy: { createdAt: 'desc' },
});

// Tri multiple
const articles = await prisma.article.findMany({
  orderBy: [
    { statut: 'asc' },
    { createdAt: 'desc' },
  ],
});

// Tri par relation
const articles = await prisma.article.findMany({
  orderBy: {
    auteur: { nom: 'asc' },  // Trier par nom de l'auteur
  },
});

// Tri par comptage de relations
const articles = await prisma.article.findMany({
  orderBy: {
    commentaires: { _count: 'desc' },  // Les plus commentes d'abord
  },
});

// Tri avec nulls en premier ou en dernier
const articles = await prisma.article.findMany({
  orderBy: {
    resume: { sort: 'asc', nulls: 'last' },
  },
});
```

---

## 4. Pagination

### 4.1 Pagination par offset (classique)

```typescript
async function findAllPaginated(page: number = 1, limit: number = 10) {
  const skip = (page - 1) * limit;

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where: { statut: 'PUBLIE' },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        auteur: { select: { id: true, nom: true } },
        _count: { select: { commentaires: true } },
      },
    }),
    prisma.article.count({ where: { statut: 'PUBLIE' } }),
  ]);

  return {
    data: articles,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}
```

### 4.2 Pagination par curseur (performante)

La pagination par curseur est plus performante pour les grands ensembles de donnees car elle n'a pas besoin de compter les lignes a sauter.

```typescript
async function findAllCursorPaginated(
  cursor?: number,
  limit: number = 10,
) {
  const articles = await prisma.article.findMany({
    where: { statut: 'PUBLIE' },
    orderBy: { id: 'asc' },
    take: limit + 1, // On prend un de plus pour savoir s'il y a une page suivante
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1, // Saute le curseur lui-meme
        }
      : {}),
    include: {
      auteur: { select: { id: true, nom: true } },
    },
  });

  const hasNextPage = articles.length > limit;
  const data = hasNextPage ? articles.slice(0, limit) : articles;
  const nextCursor = hasNextPage ? data[data.length - 1].id : null;

  return {
    data,
    meta: {
      nextCursor,
      hasNextPage,
    },
  };
}

// Utilisation :
// Page 1 : findAllCursorPaginated()
// Page 2 : findAllCursorPaginated(lastArticle.id)
```

> **Bonne pratique** : Utilisez la pagination par offset pour les interfaces avec des numéros de page (page 1, 2, 3...). Utilisez la pagination par curseur pour le scroll infini ou les grandes tables (performances superieures car pas de `OFFSET`).

---

## 5. Les Transactions

### 5.1 Transaction sequentielle

```typescript
// Les requetes sont executees dans l'ordre, dans une seule transaction
const [updatedArticle, newComment] = await prisma.$transaction([
  prisma.article.update({
    where: { id: 1 },
    data: { nombreVues: { increment: 1 } },
  }),
  prisma.comment.create({
    data: {
      contenu: 'Super article !',
      auteurId: 2,
      articleId: 1,
    },
  }),
]);
```

### 5.2 Transaction interactive

Pour les cas plus complexes ou les operations dependent les unes des autres :

```typescript
// Creer une commande avec gestion du stock
async function createOrder(
  userId: number,
  items: { productId: number; quantite: number }[],
) {
  return prisma.$transaction(async (tx) => {
    // tx est un PrismaClient transactionnel
    let total = 0;

    // Creer la commande
    const order = await tx.order.create({
      data: {
        userId,
        statut: 'EN_ATTENTE',
        total: 0,
      },
    });

    // Traiter chaque article
    for (const item of items) {
      // Verifier le stock (avec verrouillage implicite dans la transaction)
      const product = await tx.product.findUniqueOrThrow({
        where: { id: item.productId },
      });

      if (product.stock < item.quantite) {
        // Lancer une erreur annule toute la transaction
        throw new Error(
          `Stock insuffisant pour "${product.nom}". ` +
          `Demande: ${item.quantite}, Disponible: ${product.stock}`,
        );
      }

      // Decrementer le stock
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantite } },
      });

      // Creer la ligne de commande
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          quantite: item.quantite,
          prixUnitaire: product.prix,
        },
      });

      total += product.prix * item.quantite;
    }

    // Mettre a jour le total de la commande
    const finalOrder = await tx.order.update({
      where: { id: order.id },
      data: { total },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    return finalOrder;
  }, {
    maxWait: 5000,     // Temps max d'attente pour obtenir la transaction (ms)
    timeout: 10000,    // Temps max d'execution de la transaction (ms)
    isolationLevel: 'Serializable', // Niveau d'isolation (optionnel)
  });
}
```

> **A retenir** : Dans une transaction interactive (`$transaction(async (tx) => {...})`), si une erreur est lancee (throw), **toute la transaction est annulee** (ROLLBACK). Sinon, elle est validee (COMMIT).

### 5.3 Niveaux d'isolation

| Niveau | Description | Cas d'usage |
|--------|-------------|-------------|
| `ReadUncommitted` | Peut lire des donnees non commitees | Rarement utile |
| `ReadCommitted` | Lit seulement les donnees commitees | Defaut PostgreSQL |
| `RepeatableRead` | Garantit la même lecture dans la transaction | Rapports |
| `Serializable` | Isolation maximale | Operations financieres critiques |

---

## 6. Requetes SQL brutes

### 6.1 $queryRaw — Requetes SELECT brutes

```typescript
import { Prisma } from '@prisma/client';

// Requete typee avec le tagged template Prisma.sql
const articles = await prisma.$queryRaw<
  { id: number; titre: string; total_vues: number }[]
>(Prisma.sql`
  SELECT a.id, a.titre, a.nombre_vues AS total_vues
  FROM articles a
  WHERE a.statut = ${ArticleStatut.PUBLIE}
  AND a.nombre_vues > ${100}
  ORDER BY a.nombre_vues DESC
  LIMIT ${10}
`);
// Les variables sont automatiquement parametrees (protection SQL injection)

// Requete avec jointure complexe
const stats = await prisma.$queryRaw<
  { tag_nom: string; nombre_articles: number; vues_moyennes: number }[]
>(Prisma.sql`
  SELECT t.nom AS tag_nom,
         COUNT(at.article_id)::int AS nombre_articles,
         COALESCE(AVG(a.nombre_vues), 0)::float AS vues_moyennes
  FROM tags t
  LEFT JOIN "_ArticleToTag" at ON at."B" = t.id
  LEFT JOIN articles a ON a.id = at."A"
  WHERE a.statut = 'PUBLIE' OR a.statut IS NULL
  GROUP BY t.id, t.nom
  ORDER BY nombre_articles DESC
`);
```

### 6.2 $executeRaw — Requetes de modification brutes

```typescript
// Mise a jour brute
const affectedRows = await prisma.$executeRaw(Prisma.sql`
  UPDATE articles
  SET nombre_vues = nombre_vues + 1
  WHERE id = ${articleId}
`);
// affectedRows = nombre de lignes modifiees

// Requete d'insertion brute
await prisma.$executeRaw(Prisma.sql`
  INSERT INTO article_views (article_id, viewed_at, ip_address)
  VALUES (${articleId}, NOW(), ${ipAddress})
  ON CONFLICT (article_id, ip_address)
  DO UPDATE SET viewed_at = NOW()
`);
```

> **Piege classique** : Utilisez **toujours** `Prisma.sql` (tagged template) pour les requêtes brutes. Ne construisez jamais des requêtes par concatenation de chaines — c'est une faille d'injection SQL.

---

## 7. Prisma Middleware

### 7.1 Qu'est-ce qu'un middleware Prisma ?

Les middlewares Prisma interceptent les requêtes avant et après leur exécution. Ils permettent d'ajouter de la logique transversale.

```typescript
// prisma/prisma.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('PrismaService');

  constructor() {
    super();

    // Middleware de logging
    this.$use(async (params: Prisma.MiddlewareParams, next) => {
      const before = Date.now();
      const result = await next(params);
      const after = Date.now();

      this.logger.log(
        `${params.model}.${params.action} — ${after - before}ms`,
      );

      return result;
    });

    // Middleware de soft delete
    this.$use(async (params: Prisma.MiddlewareParams, next) => {
      // Intercepter les delete sur les modeles avec deletedAt
      if (params.model === 'Article') {
        if (params.action === 'delete') {
          // Transformer delete en update (soft delete)
          params.action = 'update';
          params.args['data'] = { deletedAt: new Date() };
        }

        if (params.action === 'deleteMany') {
          params.action = 'updateMany';
          if (params.args.data !== undefined) {
            params.args.data['deletedAt'] = new Date();
          } else {
            params.args['data'] = { deletedAt: new Date() };
          }
        }

        // Filtrer automatiquement les enregistrements soft-deleted
        if (params.action === 'findMany' || params.action === 'findFirst') {
          if (!params.args) params.args = {};
          if (!params.args.where) params.args.where = {};
          params.args.where.deletedAt = null;
        }
      }

      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
```

### 7.2 Middleware de timing

```typescript
// Middleware qui log les requetes lentes
this.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  const duration = Date.now() - start;

  if (duration > 200) {
    this.logger.warn(
      `Requete lente detectee : ${params.model}.${params.action} — ${duration}ms`,
    );
  }

  return result;
});
```

---

## 8. Comparaison complete : TypeORM vs Prisma

### 8.1 Approche et philosophie

| Aspect | TypeORM | Prisma |
|--------|---------|--------|
| Approche | Code-first (decorateurs) | Schema-first (fichier .prisma) |
| Pattern | Active Record + Data Mapper | Client généré unique |
| Definition du schema | Decorateurs dans les classes TypeScript | Fichier schema.prisma declaratif |
| Client | `Repository<Entity>` générique | PrismaClient généré et entièrement type |
| Communaute | Plus ancienne, plus large | En forte croissance |
| Mainteneur | Communaute open-source | Prisma (entreprise) |

### 8.2 Type Safety

```typescript
// === TypeORM — Types approximatifs ===

// Le retour de findOne est Entity | null — correct
const user = await userRepo.findOne({ where: { id: 1 } });
// user.nom ← TypeScript ne sait pas quelles relations sont chargees

// Avec relations — PAS de type-safety
const user = await userRepo.findOne({
  where: { id: 1 },
  relations: { articles: true },
});
// user.articles ← Toujours type Article[] meme si pas charge
// → Risque d'erreur a l'execution si on oublie 'relations'

// === Prisma — Types precis ===

// Sans include
const user = await prisma.user.findUnique({ where: { id: 1 } });
// user.articles ← N'EXISTE PAS dans le type (pas de propriete articles)
// → Erreur de compilation si on essaye d'y acceder

// Avec include
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: { articles: true },
});
// user.articles ← Article[] (existe dans le type)

// Avec select
const user = await prisma.user.findUnique({
  where: { id: 1 },
  select: { id: true, nom: true },
});
// user.id ← number (existe)
// user.email ← ERREUR de compilation (pas selectionne)
```

> **A retenir** : Prisma offre une type-safety **superieure** a TypeORM. Le type de retour de Prisma reflete exactement les champs et relations que vous avez demandes. Avec TypeORM, le type retourne est toujours l'entite complete, même si certaines relations ne sont pas chargees.

### 8.3 Migration

| Aspect | TypeORM | Prisma |
|--------|---------|--------|
| Génération | `migration:generate` (compare entites vs DB) | `prisma migrate dev` (compare schema vs DB) |
| Format | Fichier TypeScript avec QueryRunner | Fichier SQL pur |
| Approche | Imperative (up/down en code) | Declarative (SQL généré) |
| Revert | Méthode `down()` dans la migration | `prisma migrate reset` (reapplique tout) |
| Seed | Pas de système intégré | `prisma db seed` intégré |
| Prototypage | `synchronize: true` | `prisma db push` |

### 8.4 Requetes

```typescript
// === Requete complexe avec TypeORM (QueryBuilder) ===
const articles = await articleRepo
  .createQueryBuilder('article')
  .leftJoinAndSelect('article.auteur', 'auteur')
  .leftJoinAndSelect('article.tags', 'tag')
  .where('article.statut = :statut', { statut: 'publie' })
  .andWhere('article.titre ILIKE :terme', { terme: `%${terme}%` })
  .orderBy('article.createdAt', 'DESC')
  .skip(0)
  .take(10)
  .getMany();

// === Meme requete avec Prisma ===
const articles = await prisma.article.findMany({
  where: {
    statut: 'PUBLIE',
    titre: { contains: terme, mode: 'insensitive' },
  },
  include: {
    auteur: true,
    tags: true,
  },
  orderBy: { createdAt: 'desc' },
  skip: 0,
  take: 10,
});
```

### 8.5 Performance

| Aspect | TypeORM | Prisma |
|--------|---------|--------|
| Temps de démarrage | Rapide | Plus lent (chargement du client généré) |
| Exécution des requêtes | SQL standard | SQL optimise via moteur Rust |
| Lazy loading | Supporte (via Promises) | Non supporte (par design) |
| Eager loading | Supporte | Via include/select |
| N+1 queries | Possible si mal utilise | Evite par design (include fait des JOINs) |
| Connection pooling | Via le driver (pg) | Integre dans le moteur Prisma |

### 8.6 Experience développeur

| Aspect | TypeORM | Prisma |
|--------|---------|--------|
| Autocompletion IDE | Bonne | Excellente |
| Documentation | Correcte mais parfois datee | Excellente et a jour |
| Courbe d'apprentissage | Moyenne (beaucoup de concepts) | Douce (API intuitive) |
| Debugging | Les requêtes SQL sont visibles | Logging intégré, Prisma Studio |
| Outil visuel | Pas d'outil officiel | Prisma Studio (navigateur web) |
| Ecosysteme | TypeORM CLI | Prisma CLI, Prisma Studio, Prisma Accelerate |

### 8.7 Quand choisir lequel ?

#### Choisissez TypeORM si :

- Vous venez du monde Java/C# et connaissez les patterns Active Record/Data Mapper
- Vous avez besoin de requêtes SQL très complexes (QueryBuilder est très puissant)
- Vous travaillez avec une base de donnees existante avec un schema complexe
- Vous avez besoin du lazy loading
- Votre équipe connait déjà TypeORM
- Vous voulez un ORM entièrement en TypeScript sans dépendance binaire

#### Choisissez Prisma si :

- Vous commencez un nouveau projet
- La type-safety est une priorite
- Vous voulez une experience développeur optimale
- Vous preferez une approche declarative (schema-first)
- Vous voulez un outil visuel pour explorer les donnees (Prisma Studio)
- Vous travaillez avec PostgreSQL, MySQL ou SQLite
- Vous voulez des migrations en SQL pur

### 8.8 Tableau récapitulatif final

| Critere | TypeORM | Prisma | Gagnant |
|---------|---------|--------|---------|
| Type Safety | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Prisma |
| API intuitive | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Prisma |
| Requetes complexes | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | TypeORM |
| Migrations | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Egal |
| Performance | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Egal |
| Documentation | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Prisma |
| Ecosysteme NestJS | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | TypeORM |
| Bases supportees | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | TypeORM |
| Outils visuels | ⭐⭐ | ⭐⭐⭐⭐⭐ | Prisma |

---

## 9. Exercices pratiques

### Exercice 1 : Requetes avancees

Avec Prisma, implementez :
1. Une recherche d'articles par terme (titre ou contenu) avec pagination par curseur
2. Un classement des auteurs par nombre d'articles publies
3. Une requête qui retourne les tags les plus utilises

### Exercice 2 : Transaction

Implementez avec Prisma une transaction interactive pour :
1. Créer un nouvel utilisateur
2. Lui créer un profil
3. Lui créer 3 articles brouillon
4. Si une étape echoue, tout est annule

### Exercice 3 : Migration comparative

1. Creez le même schema (User, Article, Tag) avec TypeORM ET Prisma
2. Comparez le code nécessaire, la type-safety et la facilite de requetage
3. Notez vos observations

---

## Liens

| Ressource | Lien |
|-----------|------|
| Quiz Module 17 | `quiz/17-quiz.md` |
| Lab Module 17 | `labs/17-lab-prisma-avance.md` |
| Screencast | `screencasts/17-screencast.md` |
| Module précédent | [Module 16 — Prisma Schema & Client](16-prisma-schema-client.md) |
| Module suivant | [Module 18 — NestJS Testing](18-nestjs-testing.md) |
| Prisma Client API | https://www.prisma.io/docs/référence/api-référence/prisma-client-référence |
| Prisma Filtering | https://www.prisma.io/docs/concepts/components/prisma-client/filtering-and-sorting |
| Prisma Transactions | https://www.prisma.io/docs/concepts/components/prisma-client/transactions |
| TypeORM vs Prisma | https://www.prisma.io/docs/concepts/more/comparisons/prisma-and-typeorm |

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 17 prisma avance](../screencasts/screencast-17-prisma-avance.md)
2. **Lab** : [lab-17-prisma-avance](../labs/lab-17-prisma-avance/README)
3. **Visualisation** : [ORM Query Flow](../visualizations/orm-query-flow.html)
4. **Quiz** : [quiz 17 prisma avance](../quizzes/quiz-17-prisma-avance.html)
:::
