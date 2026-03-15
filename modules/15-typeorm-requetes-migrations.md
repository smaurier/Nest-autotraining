# Module 15 — TypeORM — Requetes, Transactions & Migrations

> **Objectif** : Maîtriser les différentes manières d'interroger la base de donnees avec TypeORM, gérer les transactions pour garantir l'integrite des donnees, et utiliser les migrations pour evoluer le schema en production.
> **Difficulte** : ⭐⭐⭐ (avance)
> **Prérequis** : Module 14 (TypeORM Entites & Relations)
> **Duree estimee** : 6 heures

---

## 1. L'API Repository — Requetes simples

### 1.1 Les méthodes de base

Le `Repository<Entity>` de TypeORM fournit un ensemble complet de méthodes pour interagir avec la base de donnees.

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article, ArticleStatus } from './entities/article.entity';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
  ) {}

  // --- CREATION ---

  async create(data: Partial<Article>): Promise<Article> {
    // create() instancie l'entite en memoire (pas de requete SQL)
    const article = this.articleRepo.create(data);
    // save() execute le INSERT INTO
    return this.articleRepo.save(article);
  }

  // Creer plusieurs entites d'un coup
  async createMany(dataList: Partial<Article>[]): Promise<Article[]> {
    const articles = this.articleRepo.create(dataList);
    return this.articleRepo.save(articles);
  }

  // --- LECTURE ---

  // Trouver tous les articles
  async findAll(): Promise<Article[]> {
    return this.articleRepo.find();
    // SQL: SELECT * FROM articles
  }

  // Trouver un par ID
  async findOne(id: number): Promise<Article> {
    const article = await this.articleRepo.findOne({
      where: { id },
    });
    if (!article) {
      throw new NotFoundException(`Article #${id} introuvable`);
    }
    return article;
  }

  // findOneBy — raccourci pour findOne avec seulement where
  async findBySlug(slug: string): Promise<Article | null> {
    return this.articleRepo.findOneBy({ slug });
    // SQL: SELECT * FROM articles WHERE slug = 'mon-slug' LIMIT 1
  }

  // findBy — raccourci pour find avec seulement where
  async findByStatus(statut: ArticleStatus): Promise<Article[]> {
    return this.articleRepo.findBy({ statut });
    // SQL: SELECT * FROM articles WHERE statut = 'publie'
  }

  // Trouver ou echouer (lance une erreur si introuvable)
  async findOneOrFail(id: number): Promise<Article> {
    return this.articleRepo.findOneOrFail({ where: { id } });
    // Lance EntityNotFoundError si pas trouve
  }

  // --- COMPTAGE ET EXISTENCE ---

  async count(): Promise<number> {
    return this.articleRepo.count();
    // SQL: SELECT COUNT(*) FROM articles
  }

  async countByStatus(statut: ArticleStatus): Promise<number> {
    return this.articleRepo.count({ where: { statut } });
    // SQL: SELECT COUNT(*) FROM articles WHERE statut = 'publie'
  }

  async exists(id: number): Promise<boolean> {
    return this.articleRepo.exist({ where: { id } });
    // SQL: SELECT 1 FROM articles WHERE id = 1 LIMIT 1
  }

  // --- MISE A JOUR ---

  // Methode 1 : Charger puis modifier (recommande — declenche les hooks)
  async update(id: number, data: Partial<Article>): Promise<Article> {
    const article = await this.articleRepo.preload({
      id,
      ...data,
    });
    if (!article) {
      throw new NotFoundException(`Article #${id} introuvable`);
    }
    return this.articleRepo.save(article);
  }

  // Methode 2 : Mise a jour directe (plus rapide mais pas de hooks)
  async updateDirect(id: number, data: Partial<Article>): Promise<void> {
    const result = await this.articleRepo.update(id, data);
    // result.affected = nombre de lignes modifiees
    if (result.affected === 0) {
      throw new NotFoundException(`Article #${id} introuvable`);
    }
  }

  // Mise a jour multiple
  async publishAll(): Promise<void> {
    await this.articleRepo.update(
      { statut: ArticleStatus.BROUILLON },
      { statut: ArticleStatus.PUBLIE },
    );
    // SQL: UPDATE articles SET statut = 'publie' WHERE statut = 'brouillon'
  }

  // --- SUPPRESSION ---

  // Methode 1 : Charger puis supprimer (declenche les hooks et cascades)
  async remove(id: number): Promise<void> {
    const article = await this.findOne(id);
    await this.articleRepo.remove(article);
  }

  // Methode 2 : Suppression directe (plus rapide)
  async deleteDirect(id: number): Promise<void> {
    const result = await this.articleRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Article #${id} introuvable`);
    }
  }

  // Soft delete
  async softRemove(id: number): Promise<void> {
    await this.articleRepo.softDelete(id);
    // SQL: UPDATE articles SET deletedAt = NOW() WHERE id = 1
  }

  // Restaurer un soft delete
  async restore(id: number): Promise<void> {
    await this.articleRepo.restore(id);
    // SQL: UPDATE articles SET deletedAt = NULL WHERE id = 1
  }

  // Inclure les entites soft-deleted
  async findAllWithDeleted(): Promise<Article[]> {
    return this.articleRepo.find({ withDeleted: true });
  }
}
```

> **A retenir** : `save()` fait un INSERT si l'entite n'a pas d'ID, ou un UPDATE si elle en à un. `update()` fait toujours un UPDATE direct sans charger l'entite. La différence clé : `save()` declenche les hooks et les cascades, `update()` non.

### 1.2 Les options de find

```typescript
// Options completes de find()
const articles = await this.articleRepo.find({
  // Conditions de filtre
  where: {
    statut: ArticleStatus.PUBLIE,
    auteurId: 1,
  },

  // Relations a charger
  relations: {
    auteur: true,
    tags: true,
    commentaires: {
      auteur: true, // Charge l'auteur de chaque commentaire
    },
  },

  // Colonnes a selectionner (optimisation)
  select: {
    id: true,
    titre: true,
    slug: true,
    createdAt: true,
    auteur: {
      id: true,
      nom: true, // Selectionne seulement id et nom de l'auteur
    },
  },

  // Tri
  order: {
    createdAt: 'DESC',      // Plus recent d'abord
    titre: 'ASC',            // Puis par titre alphabetique
  },

  // Pagination
  skip: 0,   // Offset (debut)
  take: 10,  // Limite (nombre de resultats)

  // Inclure les entites soft-deleted
  withDeleted: false,

  // Cache de la requete (en secondes)
  cache: true,
  // ou cache: { id: 'articles_list', milliseconds: 60000 }
});
```

### 1.3 Conditions de filtre avancees

```typescript
import {
  In,
  Not,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Between,
  Like,
  ILike,
  IsNull,
  Raw,
  ArrayContains,
} from 'typeorm';

// Condition IN
const articles = await this.articleRepo.find({
  where: { statut: In([ArticleStatus.PUBLIE, ArticleStatus.ARCHIVE]) },
});
// SQL: WHERE statut IN ('publie', 'archive')

// Condition NOT
const articles = await this.articleRepo.find({
  where: { statut: Not(ArticleStatus.BROUILLON) },
});
// SQL: WHERE statut != 'brouillon'

// Comparaisons numeriques
const articles = await this.articleRepo.find({
  where: { nombreVues: MoreThan(100) },
});
// SQL: WHERE nombreVues > 100

const articles = await this.articleRepo.find({
  where: { nombreVues: Between(50, 200) },
});
// SQL: WHERE nombreVues BETWEEN 50 AND 200

// Recherche textuelle
const articles = await this.articleRepo.find({
  where: { titre: Like('%typescript%') },
});
// SQL: WHERE titre LIKE '%typescript%' (sensible a la casse)

const articles = await this.articleRepo.find({
  where: { titre: ILike('%typescript%') },
});
// SQL: WHERE titre ILIKE '%typescript%' (insensible a la casse, PostgreSQL)

// Valeurs NULL
const articles = await this.articleRepo.find({
  where: { deletedAt: IsNull() },
});
// SQL: WHERE deletedAt IS NULL

// Condition OR (tableau de conditions)
const articles = await this.articleRepo.find({
  where: [
    { statut: ArticleStatus.PUBLIE },
    { auteurId: 1, statut: ArticleStatus.BROUILLON },
  ],
});
// SQL: WHERE statut = 'publie' OR (auteur_id = 1 AND statut = 'brouillon')

// Requete raw pour les cas complexes
const articles = await this.articleRepo.find({
  where: {
    nombreVues: Raw((alias) => `${alias} > :minVues`, { minVues: 100 }),
  },
});
// SQL: WHERE nombreVues > 100
```

> **Piege classique** : Quand vous passez un tableau a `where`, TypeORM interprete cela comme un **OR** entre les conditions. Chaque objet du tableau est un ensemble de conditions **AND**. Ne confondez pas avec une liste de valeurs (pour ça, utilisez `In()`).

---

## 2. Le QueryBuilder — Requetes complexes

### 2.1 Introduction au QueryBuilder

Le QueryBuilder est l'outil le plus puissant de TypeORM pour construire des requêtes SQL complexes de manière programmatique.

```typescript
// Creer un QueryBuilder a partir du repository
const qb = this.articleRepo.createQueryBuilder('article');
// 'article' est l'alias de la table dans la requete

// Equivalent : a partir du DataSource
const qb = this.dataSource
  .createQueryBuilder()
  .select('article')
  .from(Article, 'article');
```

### 2.2 Requetes SELECT avec QueryBuilder

```typescript
@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
  ) {}

  // Requete basique
  async findPublished(): Promise<Article[]> {
    return this.articleRepo
      .createQueryBuilder('article')
      .where('article.statut = :statut', { statut: 'publie' })
      .orderBy('article.createdAt', 'DESC')
      .getMany();
    // SQL: SELECT article.* FROM articles article
    //      WHERE article.statut = 'publie'
    //      ORDER BY article.createdAt DESC
  }

  // Avec jointures
  async findWithAuthorAndTags(): Promise<Article[]> {
    return this.articleRepo
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.auteur', 'auteur')    // LEFT JOIN + SELECT
      .leftJoinAndSelect('article.tags', 'tag')          // LEFT JOIN + SELECT
      .leftJoinAndSelect('article.commentaires', 'commentaire')
      .leftJoinAndSelect('commentaire.auteur', 'commentaireAuteur')
      .where('article.statut = :statut', { statut: 'publie' })
      .orderBy('article.createdAt', 'DESC')
      .addOrderBy('commentaire.createdAt', 'ASC')
      .getMany();
  }

  // Selection de colonnes specifiques
  async findTitlesAndAuthors(): Promise<any[]> {
    return this.articleRepo
      .createQueryBuilder('article')
      .select(['article.id', 'article.titre', 'article.slug'])
      .addSelect(['auteur.id', 'auteur.nom'])
      .leftJoin('article.auteur', 'auteur') // LEFT JOIN sans SELECT auto
      .where('article.statut = :statut', { statut: 'publie' })
      .getMany();
  }

  // Conditions multiples
  async search(terme: string, statut?: ArticleStatus): Promise<Article[]> {
    const qb = this.articleRepo
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.auteur', 'auteur')
      .leftJoinAndSelect('article.tags', 'tag');

    // WHERE avec LIKE
    qb.where('article.titre ILIKE :terme', { terme: `%${terme}%` });

    // Condition optionnelle
    if (statut) {
      qb.andWhere('article.statut = :statut', { statut });
    }

    // Tri et pagination
    qb.orderBy('article.createdAt', 'DESC')
      .skip(0)
      .take(10);

    return qb.getMany();
  }

  // Sous-requetes
  async findPopularAuthors(): Promise<any[]> {
    return this.articleRepo
      .createQueryBuilder('article')
      .select('auteur.id', 'auteurId')
      .addSelect('auteur.nom', 'auteurNom')
      .addSelect('COUNT(article.id)', 'nombreArticles')
      .innerJoin('article.auteur', 'auteur')
      .where('article.statut = :statut', { statut: 'publie' })
      .groupBy('auteur.id')
      .addGroupBy('auteur.nom')
      .having('COUNT(article.id) >= :min', { min: 5 })
      .orderBy('nombreArticles', 'DESC')
      .getRawMany();
    // SQL: SELECT auteur.id AS "auteurId", auteur.nom AS "auteurNom",
    //             COUNT(article.id) AS "nombreArticles"
    //      FROM articles article
    //      INNER JOIN users auteur ON article.auteur_id = auteur.id
    //      WHERE article.statut = 'publie'
    //      GROUP BY auteur.id, auteur.nom
    //      HAVING COUNT(article.id) >= 5
    //      ORDER BY "nombreArticles" DESC
  }

  // getOne() — retourne un seul resultat ou null
  async findLatestPublished(): Promise<Article | null> {
    return this.articleRepo
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.auteur', 'auteur')
      .where('article.statut = :statut', { statut: 'publie' })
      .orderBy('article.createdAt', 'DESC')
      .getOne();
  }

  // getCount() — compter les resultats
  async countPublished(): Promise<number> {
    return this.articleRepo
      .createQueryBuilder('article')
      .where('article.statut = :statut', { statut: 'publie' })
      .getCount();
  }

  // getRawMany() — resultats bruts (pas d'instances d'entite)
  async getStatsByMonth(): Promise<any[]> {
    return this.articleRepo
      .createQueryBuilder('article')
      .select("DATE_TRUNC('month', article.createdAt)", 'mois')
      .addSelect('COUNT(*)', 'total')
      .addSelect("COUNT(CASE WHEN article.statut = 'publie' THEN 1 END)", 'publies')
      .groupBy("DATE_TRUNC('month', article.createdAt)")
      .orderBy('mois', 'DESC')
      .getRawMany();
  }
}
```

### 2.3 Tableau comparatif : getMany vs getRawMany

| Méthode | Retourne | Mapping entite | Cas d'usage |
|---------|---------|----------------|-------------|
| `getMany()` | `Entity[]` | Oui | Donnees standard avec relations |
| `getOne()` | `Entity \| null` | Oui | Un seul résultat |
| `getRawMany()` | `any[]` | Non | Agregations, GROUP BY, résultats personnalises |
| `getRawOne()` | `any` | Non | Un seul résultat brut |
| `getCount()` | `number` | Non | Comptage |

> **Bonne pratique** : Utilisez `getMany()` quand vous voulez des instances d'entites avec leurs relations. Utilisez `getRawMany()` pour les agregations et les statistiques ou le mapping automatique n'est pas utile.

### 2.4 Requetes INSERT, UPDATE, DELETE avec QueryBuilder

```typescript
// INSERT
await this.articleRepo
  .createQueryBuilder()
  .insert()
  .into(Article)
  .values([
    { titre: 'Article 1', slug: 'article-1', contenu: '...', auteurId: 1 },
    { titre: 'Article 2', slug: 'article-2', contenu: '...', auteurId: 1 },
  ])
  .execute();

// UPDATE
await this.articleRepo
  .createQueryBuilder()
  .update(Article)
  .set({ statut: ArticleStatus.ARCHIVE })
  .where('createdAt < :date', { date: '2023-01-01' })
  .andWhere('statut = :statut', { statut: ArticleStatus.BROUILLON })
  .execute();
// SQL: UPDATE articles SET statut = 'archive'
//      WHERE createdAt < '2023-01-01' AND statut = 'brouillon'

// DELETE
await this.articleRepo
  .createQueryBuilder()
  .delete()
  .from(Article)
  .where('statut = :statut', { statut: ArticleStatus.ARCHIVE })
  .andWhere('nombreVues = :vues', { vues: 0 })
  .execute();

// SOFT DELETE
await this.articleRepo
  .createQueryBuilder()
  .softDelete()
  .where('id = :id', { id: 1 })
  .execute();
```

---

## 3. Les Transactions

### 3.1 Pourquoi les transactions ?

Une **transaction** garantit que plusieurs operations SQL sont executees comme une seule unite atomique. Soit toutes reussissent, soit aucune n'est appliquee.

> **Analogie** : Imaginez un virement bancaire. Si vous debitez le compte A de 100 euros, vous devez crediter le compte B de 100 euros. Si le credit echoue, le debit doit etre annule. C'est exactement ce que fait une transaction : tout ou rien.

### 3.2 Transactions avec EntityManager.transaction

La méthode la plus simple :

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from './entities/product.entity';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async createOrder(userId: number, items: { productId: number; quantite: number }[]) {
    // La transaction gere automatiquement commit/rollback
    return this.dataSource.manager.transaction(async (manager) => {
      // Etape 1 : Creer la commande
      const order = manager.create(Order, {
        userId,
        statut: 'en_attente',
        total: 0,
      });
      const savedOrder = await manager.save(order);

      let total = 0;

      // Etape 2 : Traiter chaque article
      for (const item of items) {
        // Verifier le stock
        const product = await manager.findOne(Product, {
          where: { id: item.productId },
          lock: { mode: 'pessimistic_write' }, // Verrouillage pour eviter les conflits
        });

        if (!product) {
          throw new Error(`Produit #${item.productId} introuvable`);
        }

        if (product.stock < item.quantite) {
          throw new Error(
            `Stock insuffisant pour ${product.nom}. Disponible: ${product.stock}`,
          );
        }

        // Decrémenter le stock
        product.stock -= item.quantite;
        await manager.save(product);

        // Creer la ligne de commande
        const orderItem = manager.create(OrderItem, {
          orderId: savedOrder.id,
          productId: product.id,
          quantite: item.quantite,
          prixUnitaire: product.prix,
        });
        await manager.save(orderItem);

        total += product.prix * item.quantite;
      }

      // Etape 3 : Mettre a jour le total
      savedOrder.total = total;
      await manager.save(savedOrder);

      return savedOrder;
    });
    // Si une erreur est lancee dans le callback, la transaction est annulee (ROLLBACK)
    // Sinon, elle est validee (COMMIT)
  }
}
```

### 3.3 Transactions avec QueryRunner

Pour un controle plus fin :

```typescript
async createOrderWithQueryRunner(
  userId: number,
  items: { productId: number; quantite: number }[],
) {
  // Creer un QueryRunner
  const queryRunner = this.dataSource.createQueryRunner();

  // Etablir la connexion
  await queryRunner.connect();

  // Demarrer la transaction
  await queryRunner.startTransaction();

  try {
    // Toutes les operations utilisent queryRunner.manager
    const order = queryRunner.manager.create(Order, {
      userId,
      statut: 'en_attente',
      total: 0,
    });
    const savedOrder = await queryRunner.manager.save(order);

    let total = 0;

    for (const item of items) {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: item.productId },
      });

      if (!product || product.stock < item.quantite) {
        throw new Error('Stock insuffisant');
      }

      product.stock -= item.quantite;
      await queryRunner.manager.save(product);

      const orderItem = queryRunner.manager.create(OrderItem, {
        orderId: savedOrder.id,
        productId: product.id,
        quantite: item.quantite,
        prixUnitaire: product.prix,
      });
      await queryRunner.manager.save(orderItem);

      total += product.prix * item.quantite;
    }

    savedOrder.total = total;
    await queryRunner.manager.save(savedOrder);

    // Si tout va bien : COMMIT
    await queryRunner.commitTransaction();

    return savedOrder;
  } catch (error) {
    // En cas d'erreur : ROLLBACK
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    // Toujours liberer le QueryRunner
    await queryRunner.release();
  }
}
```

> **Piege classique** : N'oubliez **jamais** `queryRunner.release()` dans le bloc `finally`. Sinon, vous aurez des fuites de connexion qui finiront par saturer votre pool de connexions.

### 3.4 Comparaison des deux approches

| Caracteristique | `manager.transaction()` | `QueryRunner` |
|----------------|------------------------|---------------|
| Simplicite | Plus simple | Plus verbeux |
| Commit/Rollback | Automatique | Manuel |
| Gestion des erreurs | Automatique | Manuelle |
| Controle fin | Limité | Total |
| Savepoints | Non | Oui |
| Isolation level | Non | Oui |

```typescript
// Avec QueryRunner, on peut definir le niveau d'isolation
await queryRunner.startTransaction('SERIALIZABLE');
// Niveaux : READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE
```

---

## 4. Les Migrations

### 4.1 Pourquoi les migrations ?

En développement, `synchronize: true` ajuste le schema automatiquement. En production, c'est dangereux. Les migrations permettent de :

- Versionner les changements de schema
- Appliquer les changements de manière controlee
- Revenir en arriere si nécessaire
- Collaborer en équipe sur le schema

> **Analogie** : Les migrations sont comme un carnet de bord pour votre base de donnees. Chaque page decrit un changement précis, dans l'ordre chronologique. Vous pouvez avancer page par page (appliquer) ou reculer (annuler).

### 4.2 Configuration du CLI TypeORM

Pour utiliser les migrations, il faut configurer la CLI TypeORM.

```typescript
// data-source.ts (a la racine du projet)
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config(); // Charge les variables d'environnement

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'nest_course',
  entities: ['dist/**/*.entity.js'],        // Entites compilees
  migrations: ['dist/migrations/*.js'],      // Migrations compilees
  migrationsTableName: 'typeorm_migrations', // Nom de la table de suivi
});
```

Ajouter les scripts dans `package.json` :

```json
{
  "scripts": {
    "typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js",
    "migration:generate": "npm run typeorm -- migration:generate -d data-source.ts",
    "migration:create": "npm run typeorm -- migration:create",
    "migration:run": "npm run typeorm -- migration:run -d data-source.ts",
    "migration:revert": "npm run typeorm -- migration:revert -d data-source.ts",
    "migration:show": "npm run typeorm -- migration:show -d data-source.ts"
  }
}
```

### 4.3 Générer une migration

```bash
# Generer une migration basee sur les differences entre entites et schema actuel
npm run migration:generate -- src/migrations/InitialSchema

# Cela cree un fichier comme : src/migrations/1705320000000-InitialSchema.ts
```

Fichier généré :

```typescript
// migrations/1705320000000-InitialSchema.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1705320000000 implements MigrationInterface {
  name = 'InitialSchema1705320000000';

  // Applique la migration (schema vers le haut)
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL NOT NULL,
        "nom" character varying(100) NOT NULL,
        "email" character varying NOT NULL,
        "motDePasse" character varying NOT NULL,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'lecteur',
        "actif" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "articles" (
        "id" SERIAL NOT NULL,
        "titre" character varying(200) NOT NULL,
        "slug" character varying NOT NULL,
        "contenu" text NOT NULL,
        "statut" "public"."articles_statut_enum" NOT NULL DEFAULT 'brouillon',
        "nombreVues" integer NOT NULL DEFAULT 0,
        "auteur_id" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_articles_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_articles_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "articles"
      ADD CONSTRAINT "FK_articles_auteur"
      FOREIGN KEY ("auteur_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Index
    await queryRunner.query(`
      CREATE INDEX "IDX_articles_slug" ON "articles" ("slug")
    `);
  }

  // Annule la migration (schema vers le bas)
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_articles_slug"`);
    await queryRunner.query(`ALTER TABLE "articles" DROP CONSTRAINT "FK_articles_auteur"`);
    await queryRunner.query(`DROP TABLE "articles"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
```

### 4.4 Créer une migration vide

Pour les changements qui ne touchent pas les entites (donnees de seed, index personnalises) :

```bash
npm run migration:create -- src/migrations/SeedDefaultCategories
```

```typescript
// migrations/1705320100000-SeedDefaultCategories.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultCategories1705320100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "categories" ("nom", "slug", "description") VALUES
        ('Technologie', 'technologie', 'Articles sur la tech'),
        ('Science', 'science', 'Articles scientifiques'),
        ('Programmation', 'programmation', 'Tutoriels de code'),
        ('DevOps', 'devops', 'Infrastructure et deploiement')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "categories"
      WHERE "slug" IN ('technologie', 'science', 'programmation', 'devops')
    `);
  }
}
```

### 4.5 Commandes de migration

```bash
# Voir les migrations (appliquees et en attente)
npm run migration:show

# Appliquer toutes les migrations en attente
npm run migration:run

# Annuler la derniere migration appliquee
npm run migration:revert

# En production, apres build
npm run build
npx typeorm migration:run -d dist/data-source.js
```

> **Bonne pratique** : Toujours générer les migrations avec `migration:generate`, ne les ecrivez pas à la main sauf pour les donnees de seed. Et testez toujours le `down()` avant de déployer.

---

## 5. Les Subscribers — Hooks de base de donnees

### 5.1 Créer un Subscriber

Les subscribers permettent d'ecouter les événements de l'ORM (avant/après insert, update, delete, load).

```typescript
// subscribers/article.subscriber.ts
import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
  LoadEvent,
} from 'typeorm';
import { Article } from '../entities/article.entity';
import { Logger } from '@nestjs/common';

@EventSubscriber()
export class ArticleSubscriber implements EntitySubscriberInterface<Article> {
  private readonly logger = new Logger('ArticleSubscriber');

  // Specifie l'entite ciblee
  listenTo() {
    return Article;
  }

  // Avant l'insertion
  beforeInsert(event: InsertEvent<Article>) {
    this.logger.log(`Avant insertion d'un article : ${event.entity.titre}`);

    // Generer le slug automatiquement
    if (!event.entity.slug && event.entity.titre) {
      event.entity.slug = this.generateSlug(event.entity.titre);
    }
  }

  // Apres l'insertion
  afterInsert(event: InsertEvent<Article>) {
    this.logger.log(`Article insere avec l'ID : ${event.entity.id}`);
    // On pourrait envoyer une notification, mettre a jour un cache, etc.
  }

  // Avant la mise a jour
  beforeUpdate(event: UpdateEvent<Article>) {
    this.logger.log(`Mise a jour de l'article #${event.entity?.id}`);
  }

  // Apres le chargement
  afterLoad(entity: Article, event?: LoadEvent<Article>) {
    // Ajouter une propriete calculee
    // (attention : ne pas abuser, ca s'execute a CHAQUE chargement)
  }

  // Avant la suppression
  beforeRemove(event: RemoveEvent<Article>) {
    this.logger.log(`Suppression de l'article #${event.entityId}`);
  }

  private generateSlug(titre: string): string {
    return titre
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
```

### 5.2 Enregistrer le subscriber

```typescript
// app.module.ts
TypeOrmModule.forRootAsync({
  // ...
  useFactory: (configService: ConfigService) => ({
    // ...
    subscribers: [ArticleSubscriber],
  }),
});
```

> **Piege classique** : Les subscribers ne sont pas declenches par les méthodes `update()` et `delete()` du repository. Ils ne fonctionnent qu'avec `save()`, `remove()`, `softRemove()`. Si vous utilisez des subscribers, assurez-vous d'utiliser les bonnes méthodes.

---

## 6. Pagination

### 6.1 Helper de pagination réutilisable

```typescript
// common/pagination.ts
export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export function paginate<T>(
  data: T[],
  total: number,
  options: PaginationOptions,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / options.limit);

  return {
    data,
    meta: {
      total,
      page: options.page,
      limit: options.limit,
      totalPages,
      hasNextPage: options.page < totalPages,
      hasPreviousPage: options.page > 1,
    },
  };
}
```

```typescript
// articles.service.ts
async findAllPaginated(
  page: number = 1,
  limit: number = 10,
  statut?: ArticleStatus,
): Promise<PaginatedResult<Article>> {
  const qb = this.articleRepo
    .createQueryBuilder('article')
    .leftJoinAndSelect('article.auteur', 'auteur')
    .leftJoinAndSelect('article.tags', 'tag')
    .orderBy('article.createdAt', 'DESC');

  if (statut) {
    qb.where('article.statut = :statut', { statut });
  }

  // skip et take pour la pagination
  qb.skip((page - 1) * limit).take(limit);

  // getManyAndCount retourne [data, total]
  const [data, total] = await qb.getManyAndCount();

  return paginate(data, total, { page, limit });
}
```

Utilisation dans le controller :

```typescript
@Get()
async findAll(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  @Query('statut') statut?: ArticleStatus,
) {
  return this.articlesService.findAllPaginated(page, limit, statut);
}
```

Reponse JSON :

```json
{
  "data": [
    { "id": 1, "titre": "Mon article", "auteur": { "id": 1, "nom": "Alice" } },
    { "id": 2, "titre": "Autre article", "auteur": { "id": 2, "nom": "Bob" } }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

## 7. Requetes complexes — Exemples pratiques

### 7.1 Recherche full-text avec PostgreSQL

```typescript
async searchFullText(terme: string): Promise<Article[]> {
  return this.articleRepo
    .createQueryBuilder('article')
    .leftJoinAndSelect('article.auteur', 'auteur')
    .where(
      `to_tsvector('french', article.titre || ' ' || article.contenu) @@ plainto_tsquery('french', :terme)`,
      { terme },
    )
    .orderBy(
      `ts_rank(to_tsvector('french', article.titre || ' ' || article.contenu), plainto_tsquery('french', :terme))`,
      'DESC',
    )
    .getMany();
}
```

### 7.2 Requête avec sous-requête

```typescript
// Trouver les articles des auteurs les plus actifs
async findArticlesFromTopAuthors(): Promise<Article[]> {
  const subQuery = this.articleRepo
    .createQueryBuilder('sub')
    .select('sub.auteur_id')
    .groupBy('sub.auteur_id')
    .having('COUNT(*) >= :minArticles');

  return this.articleRepo
    .createQueryBuilder('article')
    .leftJoinAndSelect('article.auteur', 'auteur')
    .where(`article.auteur_id IN (${subQuery.getQuery()})`)
    .setParameter('minArticles', 3)
    .orderBy('article.createdAt', 'DESC')
    .getMany();
}
```

### 7.3 Requête avec agregation et jointure

```typescript
// Statistiques par tag
async getStatsByTag(): Promise<any[]> {
  return this.articleRepo
    .createQueryBuilder('article')
    .innerJoin('article.tags', 'tag')
    .select('tag.nom', 'tagNom')
    .addSelect('COUNT(article.id)', 'nombreArticles')
    .addSelect('AVG(article.nombreVues)', 'moyenneVues')
    .addSelect('SUM(article.nombreVues)', 'totalVues')
    .where('article.statut = :statut', { statut: 'publie' })
    .groupBy('tag.id')
    .addGroupBy('tag.nom')
    .orderBy('nombreArticles', 'DESC')
    .getRawMany();
}
```

### 7.4 Mise a jour conditionnelle avec CASE

```typescript
// Incrementer les vues de maniere atomique
async incrementViews(articleId: number): Promise<void> {
  await this.articleRepo
    .createQueryBuilder()
    .update(Article)
    .set({
      nombreVues: () => '"nombreVues" + 1',
    })
    .where('id = :id', { id: articleId })
    .execute();
}
```

---

## 8. Requetes SQL brutes

Parfois, le QueryBuilder ne suffit pas. Vous pouvez exécuter du SQL brut :

```typescript
// Via le DataSource
const result = await this.dataSource.query(
  `SELECT u.nom, COUNT(a.id) as total
   FROM users u
   LEFT JOIN articles a ON a.auteur_id = u.id
   WHERE u.actif = $1
   GROUP BY u.id, u.nom
   ORDER BY total DESC
   LIMIT $2`,
  [true, 10],
);
// result est un tableau d'objets { nom: string, total: number }
```

> **Piege classique** : Utilisez toujours des paramètres (`$1`, `$2` pour PostgreSQL, `?` pour MySQL) pour éviter les injections SQL. Ne concatenez **jamais** des valeurs utilisateur directement dans la chaine SQL.

---

## 9. Exercices pratiques

### Exercice 1 : CRUD avec QueryBuilder

Implementez un `ArticlesService` complet avec :
- `findAll()` avec pagination, tri et filtre par statut
- `search()` avec recherche par titre (ILIKE)
- `findWithStats()` qui retourne les articles avec le nombre de commentaires

### Exercice 2 : Transaction

Implementez une méthode `transferArticle(articleId, fromUserId, toUserId)` qui :
1. Verifie que l'article appartient bien a `fromUserId`
2. Change l'auteur vers `toUserId`
3. Cree un log de transfert dans une table `transfer_logs`
4. Le tout dans une transaction

### Exercice 3 : Migration

1. Ajoutez un champ `nombreLikes` a l'entite Article
2. Generez la migration correspondante
3. Executez-la et verifiez en base
4. Revertez-la

---

## Liens

| Ressource | Lien |
|-----------|------|
| Quiz Module 15 | `quiz/15-quiz.md` |
| Lab Module 15 | `labs/15-lab-typeorm-requetes.md` |
| Screencast | `screencasts/15-screencast.md` |
| Module précédent | [Module 14 — TypeORM Entites & Relations](14-typeorm-entites-relations.md) |
| Module suivant | [Module 16 — Prisma Schema & Client](16-prisma-schema-client.md) |
| TypeORM QueryBuilder | https://typeorm.io/select-query-builder |
| TypeORM Transactions | https://typeorm.io/transactions |
| TypeORM Migrations | https://typeorm.io/migrations |

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 15 typeorm requêtes](../screencasts/screencast-15-typeorm-requetes.md)
2. **Lab** : [lab-15-typeorm-queries](../labs/lab-15-typeorm-queries/README)
3. **Visualisation** : [ORM Query Flow](../visualizations/orm-query-flow.html)
4. **Quiz** : [quiz 15 typeorm requêtes](../quizzes/quiz-15-typeorm-requetes.html)
:::
