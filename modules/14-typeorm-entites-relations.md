# Module 14 — TypeORM — Entites & Relations

> **Objectif** : Apprendre a modeliser une base de donnees relationnelle avec TypeORM dans NestJS, en maitrisant les entites, les types de colonnes, et toutes les formes de relations.
> **Difficulte** : ⭐⭐⭐ (avance)
> **Prerequis** : Module 11 (Services & Providers), Module 12 (Modules), notions SQL de base
> **Duree estimee** : 5 heures

---

## 1. Introduction a TypeORM

### 1.1 Qu'est-ce qu'un ORM ?

Un **ORM** (Object-Relational Mapping) est un outil qui fait le pont entre le monde des objets (TypeScript/JavaScript) et le monde des bases de donnees relationnelles (SQL).

> **Analogie** : Imaginez que vous parlez francais et que votre base de donnees parle chinois. L'ORM est votre traducteur personnel. Vous lui decrivez ce que vous voulez en francais (TypeScript), et il traduit en chinois (SQL) pour la base de donnees, puis vous ramene la reponse en francais.

### 1.2 Pourquoi TypeORM ?

TypeORM est l'ORM le plus utilise dans l'ecosysteme NestJS. Il supporte :

| Caracteristique | Description |
|----------------|-------------|
| TypeScript natif | Decorateurs, types, autocompletion |
| Bases supportees | PostgreSQL, MySQL, SQLite, MSSQL, Oracle, MongoDB |
| Patterns | Active Record et Data Mapper |
| Migrations | Generation et execution automatiques |
| Relations | OneToOne, OneToMany, ManyToOne, ManyToMany |
| CLI | Outil en ligne de commande pour les migrations |

### 1.3 Installation

```bash
# Installation des packages
npm install @nestjs/typeorm typeorm pg

# pg = driver PostgreSQL
# Pour MySQL : npm install mysql2
# Pour SQLite : npm install better-sqlite3
```

---

## 2. Configuration de TypeORM dans NestJS

### 2.1 Configuration basique avec forRoot

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'nest_course',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      // ⚠️ Sur Windows, ce glob peut ne pas fonctionner correctement.
      // Alternative recommandee (compatible Windows) :
      // entities: [User, Article, Comment, Tag],
      synchronize: true, // ATTENTION : uniquement en developpement !
    }),
  ],
})
export class AppModule {}
```

> **Piege classique** : L'option `synchronize: true` modifie automatiquement le schema de la base de donnees pour correspondre a vos entites. C'est pratique en dev, mais **CATASTROPHIQUE en production** car vous risquez de perdre des donnees. En production, utilisez les **migrations** (voir Module 15).

### 2.2 Configuration avancee avec forRootAsync et ConfigService

En pratique, on ne veut jamais coder les identifiants en dur. On utilise le `ConfigService` :

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_DATABASE', 'nest_course'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),
  ],
})
export class AppModule {}
```

Fichier `.env` correspondant :

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=monMotDePasse
DB_DATABASE=nest_course
NODE_ENV=development
```

### 2.3 Enregistrer les entites dans un module

Chaque module qui utilise des entites doit les importer via `TypeOrmModule.forFeature()` :

```typescript
// users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), // Enregistre l'entite User dans ce module
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

---

## 3. Les Entites — Definir vos tables

### 3.1 Le decorateur @Entity

Une entite est une classe TypeScript decoree avec `@Entity()`. Chaque entite correspond a une table en base de donnees.

```typescript
// entities/user.entity.ts
import { Entity } from 'typeorm';

// Le nom de la table sera 'user' par defaut (nom de la classe en minuscule)
@Entity()
export class User {}

// On peut specifier un nom de table different
@Entity('utilisateurs')
export class User {}

// Avec des options supplementaires
@Entity({
  name: 'utilisateurs',
  schema: 'public',      // Schema PostgreSQL
  orderBy: {
    createdAt: 'DESC',    // Ordre par defaut des requetes
  },
})
export class User {}
```

### 3.2 Les colonnes primaires

Chaque entite doit avoir au moins une colonne primaire.

```typescript
import { Entity, PrimaryGeneratedColumn, PrimaryColumn } from 'typeorm';

// Option 1 : ID auto-incremente (le plus courant)
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;
  // Cree : id SERIAL PRIMARY KEY (PostgreSQL)
  // Ou : id INT AUTO_INCREMENT PRIMARY KEY (MySQL)
}

// Option 2 : UUID genere automatiquement
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  // Cree : id UUID DEFAULT uuid_generate_v4() PRIMARY KEY
}

// Option 3 : Cle primaire manuelle (non generee)
@Entity()
export class Country {
  @PrimaryColumn()
  code: string; // ex: 'FR', 'US', 'DE'
}
```

> **Bonne pratique** : Preferez les UUID pour les API publiques. Ils ne revelent pas le nombre d'enregistrements et sont plus difficiles a deviner. Utilisez les ID auto-incrementes pour les tables internes ou quand la performance est critique.

| Type | Avantages | Inconvenients |
|------|-----------|---------------|
| `increment` (defaut) | Performant, indexation optimale | Previsible, revele le volume |
| `uuid` | Non previsible, distribue | Plus gros (16 octets vs 4), indexation moins optimale |

### 3.3 Les types de colonnes

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  // --- Types chaines ---

  @Column()
  // Type par defaut : varchar(255)
  nom: string;

  @Column({ type: 'varchar', length: 100 })
  // varchar(100) — chaine limitee
  sku: string;

  @Column({ type: 'text' })
  // text — chaine sans limite de taille
  description: string;

  // --- Types numeriques ---

  @Column({ type: 'int' })
  stock: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  // decimal(10,2) — pour les prix (ex: 12345678.99)
  prix: number;

  @Column({ type: 'float' })
  // Nombre a virgule flottante
  poids: number;

  @Column({ type: 'bigint' })
  // Grand entier (retourne comme string en JS !)
  vues: string;

  // --- Type booleen ---

  @Column({ type: 'boolean', default: true })
  actif: boolean;

  // --- Types date ---

  @Column({ type: 'date' })
  // Date sans heure (YYYY-MM-DD)
  datePublication: string;

  @Column({ type: 'timestamp' })
  // Date avec heure
  derniereMiseAJour: Date;

  // --- Type enum ---

  @Column({
    type: 'enum',
    enum: ['brouillon', 'publie', 'archive'],
    default: 'brouillon',
  })
  statut: string;

  // --- Type JSON ---

  @Column({ type: 'json', nullable: true })
  // Stocke un objet JSON directement
  metadata: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  // jsonb (PostgreSQL) — indexable et plus performant que json
  tags: string[];

  // --- Type tableau (PostgreSQL uniquement) ---

  @Column({ type: 'simple-array', nullable: true })
  // Stocke comme une chaine separee par des virgules
  couleurs: string[];
}
```

### 3.4 Options des colonnes

```typescript
@Entity()
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 200,
    unique: true,           // Contrainte UNIQUE
    nullable: false,         // NOT NULL (par defaut)
    default: 'Sans titre',   // Valeur par defaut
    comment: 'Titre de l\'article', // Commentaire SQL
    select: true,            // Inclus dans les SELECT par defaut
    name: 'article_title',   // Nom de la colonne en base (si different de la propriete)
  })
  titre: string;

  @Column({ select: false })
  // Cette colonne ne sera PAS incluse dans les requetes par defaut
  // Il faudra la demander explicitement avec addSelect() ou select
  motDePasse: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  // nullable: true permet la valeur NULL en base
  imageUrl: string | null;
}
```

### 3.5 Colonnes speciales : dates automatiques

TypeORM fournit des decorateurs tres pratiques pour gerer automatiquement les dates :

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
} from 'typeorm';

@Entity()
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  titre: string;

  // Automatiquement defini a la date de creation
  @CreateDateColumn()
  createdAt: Date;
  // → Equivalent SQL : DEFAULT CURRENT_TIMESTAMP

  // Automatiquement mis a jour a chaque modification
  @UpdateDateColumn()
  updatedAt: Date;
  // → Se met a jour automatiquement quand on appelle save()

  // Pour le soft delete : date de suppression
  @DeleteDateColumn()
  deletedAt: Date | null;
  // → null = non supprime, date = supprime
  // Les requetes normales excluent automatiquement les lignes "supprimees"

  // Compteur de version pour l'optimistic locking
  @VersionColumn()
  version: number;
  // → S'incremente automatiquement a chaque save()
}
```

> **Analogie** : Le soft delete c'est comme mettre un document a la corbeille plutot que le dechiqueter. Le document existe toujours, mais il n'apparait plus dans vos recherches normales. Vous pouvez le restaurer a tout moment.

### 3.6 Utiliser des enums TypeScript

```typescript
// enums/article-status.enum.ts
export enum ArticleStatus {
  BROUILLON = 'brouillon',
  PUBLIE = 'publie',
  ARCHIVE = 'archive',
}

// entities/article.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ArticleStatus } from '../enums/article-status.enum';

@Entity()
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  titre: string;

  @Column({
    type: 'enum',
    enum: ArticleStatus,
    default: ArticleStatus.BROUILLON,
  })
  statut: ArticleStatus;
}
```

---

## 4. Les Relations

Les relations sont le coeur de la modelisation relationnelle. TypeORM supporte quatre types de relations.

### 4.1 @ManyToOne et @OneToMany — La relation la plus courante

C'est la relation "un vers plusieurs". Exemple : un utilisateur a plusieurs articles, chaque article appartient a un utilisateur.

```typescript
// entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Article } from './article.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  nom: string;

  // Un utilisateur a PLUSIEURS articles
  @OneToMany(() => Article, (article) => article.auteur)
  articles: Article[];
  // Note : @OneToMany ne cree PAS de colonne en base
  // C'est le cote @ManyToOne qui possede la cle etrangere

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

```typescript
// entities/article.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity()
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  titre: string;

  @Column({ type: 'text' })
  contenu: string;

  // Chaque article appartient a UN utilisateur
  @ManyToOne(() => User, (user) => user.articles, {
    nullable: false,        // L'article DOIT avoir un auteur
    onDelete: 'CASCADE',    // Si l'utilisateur est supprime, ses articles aussi
  })
  @JoinColumn({ name: 'auteur_id' }) // Nom personnalise de la colonne FK
  auteur: User;

  // Colonne explicite pour l'ID de l'auteur (optionnel mais pratique)
  @Column({ name: 'auteur_id' })
  auteurId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

> **Piege classique** : La relation `@OneToMany` ne cree pas de colonne en base de donnees. C'est toujours le cote `@ManyToOne` qui possede la cle etrangere. Si vous n'avez qu'un `@OneToMany` sans son `@ManyToOne` correspondant, TypeORM ne creera aucune cle etrangere.

> ⚠️ **Piege N+1** : charger `user.articles` pour chaque user dans une boucle genere N+1 requetes.
> Solution : utiliser `relations: ['articles']` dans `find()`, ou le QueryBuilder avec `leftJoinAndSelect()` (module 15).

#### Le comportement onDelete

| Valeur | Description | Exemple |
|--------|-------------|---------|
| `CASCADE` | Supprime les enfants avec le parent | Supprimer un user → ses articles sont supprimes |
| `SET NULL` | Met la FK a NULL | Supprimer un user → articles.auteurId = NULL |
| `RESTRICT` | Empeche la suppression si des enfants existent | Impossible de supprimer un user qui a des articles |
| `NO ACTION` | Similaire a RESTRICT (defaut) | Erreur si tentative de suppression |

### 4.2 @OneToOne — Relation un-a-un

Chaque utilisateur a un seul profil, et chaque profil appartient a un seul utilisateur.

```typescript
// entities/profile.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity()
export class Profile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ nullable: true })
  siteWeb: string;

  @Column({ nullable: true })
  localisation: string;

  // Relation One-to-One avec User
  // @JoinColumn() est OBLIGATOIRE sur un des deux cotes
  // Le cote qui a @JoinColumn possede la cle etrangere
  @OneToOne(() => User, (user) => user.profile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  user: User;

  @Column()
  userId: number;
}
```

```typescript
// entities/user.entity.ts (mise a jour)
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { Profile } from './profile.entity';
import { Article } from './article.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  nom: string;

  // Cote inverse de la relation One-to-One (pas de @JoinColumn ici)
  @OneToOne(() => Profile, (profile) => profile.user)
  profile: Profile;

  @OneToMany(() => Article, (article) => article.auteur)
  articles: Article[];
}
```

> **A retenir** : Dans une relation `@OneToOne`, le decorateur `@JoinColumn()` est **obligatoire** sur exactement un des deux cotes. Le cote qui le porte est celui qui aura la colonne de cle etrangere en base.

### 4.3 @ManyToMany — Relation plusieurs-a-plusieurs

Exemple : un article peut avoir plusieurs tags, et un tag peut etre associe a plusieurs articles.

```typescript
// entities/tag.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
} from 'typeorm';
import { Article } from './article.entity';

@Entity()
export class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nom: string;

  @Column({ nullable: true })
  description: string;

  // Cote inverse (pas de @JoinTable)
  @ManyToMany(() => Article, (article) => article.tags)
  articles: Article[];
}
```

```typescript
// entities/article.entity.ts (mise a jour)
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Tag } from './tag.entity';

@Entity()
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  titre: string;

  @Column({ type: 'text' })
  contenu: string;

  @ManyToOne(() => User, (user) => user.articles, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'auteur_id' })
  auteur: User;

  @Column({ name: 'auteur_id' })
  auteurId: number;

  // Relation Many-to-Many avec Tag
  // @JoinTable() est OBLIGATOIRE sur un des deux cotes
  // Il cree automatiquement une table de liaison (article_tags_tag)
  @ManyToMany(() => Tag, (tag) => tag.articles, {
    cascade: true, // Permet de creer des tags en meme temps que l'article
  })
  @JoinTable({
    name: 'article_tag', // Nom personnalise de la table de liaison
    joinColumn: {
      name: 'article_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'tag_id',
      referencedColumnName: 'id',
    },
  })
  tags: Tag[];
}
```

> **Bonne pratique** : Personnalisez toujours les noms de colonnes dans `@JoinTable()` pour avoir des noms clairs et previsibles. Le nommage automatique de TypeORM peut etre confus (`article_tags_tag`).

### 4.4 Tableau recapitulatif des relations

| Relation | Decorateur proprietaire | Decorateur inverse | Decorateur join | Table de liaison |
|----------|------------------------|-------------------|-----------------|-----------------|
| One-to-One | `@OneToOne` + `@JoinColumn` | `@OneToOne` | `@JoinColumn` (obligatoire) | Non |
| Many-to-One / One-to-Many | `@ManyToOne` | `@OneToMany` | `@JoinColumn` (optionnel) | Non |
| Many-to-Many | `@ManyToMany` + `@JoinTable` | `@ManyToMany` | `@JoinTable` (obligatoire) | Oui |

---

## 5. Chargement des relations : eager vs lazy

### 5.1 Eager loading

Les relations avec `eager: true` sont **toujours** chargees automatiquement :

```typescript
@ManyToOne(() => User, (user) => user.articles, {
  eager: true, // Le user sera toujours charge avec l'article
})
auteur: User;
```

> **Piege classique** : N'utilisez `eager: true` que pour les relations qui sont **toujours** necessaires. Sinon, chaque requete chargera des donnees inutiles, degradant les performances.

### 5.2 Lazy loading

Les relations lazy sont chargees **a la demande** via des Promises :

```typescript
@OneToMany(() => Article, (article) => article.auteur, {
  lazy: true,
})
articles: Promise<Article[]>; // Note : le type est Promise<>

// Utilisation
const user = await userRepository.findOne({ where: { id: 1 } });
const articles = await user.articles; // La requete SQL est executee ICI
```

### 5.3 Chargement explicite avec relations (recommande)

La methode la plus courante et la plus controlee :

```typescript
// Charger un article avec son auteur et ses tags
const article = await articleRepository.findOne({
  where: { id: 1 },
  relations: {
    auteur: true,          // Charge l'auteur
    tags: true,            // Charge les tags
    auteur: {
      profile: true,       // Charge aussi le profil de l'auteur (imbrique)
    },
  },
});
```

> **Bonne pratique** : Preferez toujours le chargement explicite avec `relations` plutot que `eager: true` ou `lazy: true`. Cela vous donne un controle total sur les donnees chargees pour chaque requete.

---

## 6. Les options Cascade

Les cascades controlent le comportement automatique lors des operations de sauvegarde.

```typescript
@OneToMany(() => Article, (article) => article.auteur, {
  cascade: true,          // Active toutes les cascades
  // OU plus specifique :
  cascade: ['insert'],    // Cascade uniquement a l'insertion
  cascade: ['insert', 'update'], // Cascade insertion et mise a jour
  cascade: ['insert', 'update', 'remove'], // Toutes les operations
})
articles: Article[];
```

Exemple d'utilisation :

```typescript
// Avec cascade: true sur la relation articles
const user = new User();
user.nom = 'Alice';
user.email = 'alice@example.com';

const article1 = new Article();
article1.titre = 'Mon premier article';
article1.contenu = 'Contenu...';

const article2 = new Article();
article2.titre = 'Mon deuxieme article';
article2.contenu = 'Contenu...';

// Les articles sont assignes a l'utilisateur
user.articles = [article1, article2];

// Un seul save() cree l'utilisateur ET ses deux articles
await userRepository.save(user);
```

> **Piege classique** : `cascade: true` est tres pratique mais peut mener a des sauvegardes involontaires. Si vous modifiez un objet relie accidentellement, il sera sauvegarde aussi. Utilisez les cascades avec parcimonie.

---

## 7. Le Repository Pattern

### 7.1 Injection du Repository

```typescript
// users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // Creer un utilisateur
  async create(createUserDto: CreateUserDto): Promise<User> {
    // create() cree une instance SANS sauvegarder en base
    const user = this.userRepository.create(createUserDto);
    // save() persiste en base de donnees
    return this.userRepository.save(user);
  }

  // Recuperer tous les utilisateurs
  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: { profile: true },
      order: { createdAt: 'DESC' },
    });
  }

  // Recuperer un utilisateur par ID
  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { profile: true, articles: true },
    });
    if (!user) {
      throw new NotFoundException(`Utilisateur #${id} introuvable`);
    }
    return user;
  }

  // Mettre a jour un utilisateur
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    // preload() charge l'entite existante et fusionne les nouvelles donnees
    const user = await this.userRepository.preload({
      id,
      ...updateUserDto,
    });
    if (!user) {
      throw new NotFoundException(`Utilisateur #${id} introuvable`);
    }
    return this.userRepository.save(user);
  }

  // Supprimer un utilisateur
  async remove(id: number): Promise<void> {
    const user = await this.findOne(id); // Verifie que l'utilisateur existe
    await this.userRepository.remove(user);
  }

  // Soft delete (necessite @DeleteDateColumn dans l'entite)
  async softRemove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.softRemove(user);
  }

  // Restaurer un utilisateur soft-deleted
  async restore(id: number): Promise<void> {
    await this.userRepository.restore(id);
  }

  // Trouver par email
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }
}
```

> **A retenir** : La difference entre `create()` et `save()` est fondamentale. `create()` cree une instance en memoire (utile pour appliquer les valeurs par defaut et les transformations). `save()` persiste l'objet en base. Utilisez toujours `create()` avant `save()` pour un code propre.

### 7.2 Difference entre save, update et delete

| Methode | Retourne | Hooks d'entite | Cascade | Utilisation |
|---------|---------|----------------|---------|-------------|
| `save(entity)` | L'entite sauvegardee | Oui | Oui | Creation ou mise a jour |
| `update(criteria, data)` | UpdateResult | Non | Non | Mise a jour rapide sans charger |
| `remove(entity)` | L'entite supprimee | Oui | Oui | Suppression apres chargement |
| `delete(criteria)` | DeleteResult | Non | Non | Suppression rapide sans charger |
| `softRemove(entity)` | L'entite | Oui | Oui | Soft delete apres chargement |
| `softDelete(criteria)` | UpdateResult | Non | Non | Soft delete rapide |

---

## 8. Exemple complet — Blog avec Users, Articles, Commentaires et Tags

Voici un exemple complet qui met en pratique tous les concepts :

```typescript
// === entities/user.entity.ts ===
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Profile } from './profile.entity';
import { Article } from './article.entity';
import { Comment } from './comment.entity';

export enum UserRole {
  ADMIN = 'admin',
  AUTEUR = 'auteur',
  LECTEUR = 'lecteur',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nom: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false }) // Non inclus dans les SELECT par defaut
  motDePasse: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.LECTEUR,
  })
  role: UserRole;

  @Column({ default: true })
  actif: boolean;

  @OneToOne(() => Profile, (profile) => profile.user, {
    cascade: true,
  })
  profile: Profile;

  @OneToMany(() => Article, (article) => article.auteur)
  articles: Article[];

  @OneToMany(() => Comment, (comment) => comment.auteur)
  commentaires: Comment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
```

```typescript
// === entities/profile.entity.ts ===
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ nullable: true })
  siteWeb: string;

  @Column({ nullable: true })
  twitter: string;

  @Column({ nullable: true })
  github: string;

  @OneToOne(() => User, (user) => user.profile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  user: User;

  @Column()
  userId: number;
}
```

```typescript
// === entities/article.entity.ts ===
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Comment } from './comment.entity';
import { Tag } from './tag.entity';

export enum ArticleStatus {
  BROUILLON = 'brouillon',
  PUBLIE = 'publie',
  ARCHIVE = 'archive',
}

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  titre: string;

  @Column({ unique: true })
  @Index() // Index pour les recherches par slug
  slug: string;

  @Column({ type: 'text', nullable: true })
  resume: string;

  @Column({ type: 'text' })
  contenu: string;

  @Column({
    type: 'enum',
    enum: ArticleStatus,
    default: ArticleStatus.BROUILLON,
  })
  statut: ArticleStatus;

  @Column({ default: 0 })
  nombreVues: number;

  @ManyToOne(() => User, (user) => user.articles, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'auteur_id' })
  auteur: User;

  @Column({ name: 'auteur_id' })
  auteurId: number;

  @OneToMany(() => Comment, (comment) => comment.article, {
    cascade: true,
  })
  commentaires: Comment[];

  @ManyToMany(() => Tag, (tag) => tag.articles, {
    cascade: ['insert'],
  })
  @JoinTable({
    name: 'article_tag',
    joinColumn: { name: 'article_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

```typescript
// === entities/comment.entity.ts ===
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Article } from './article.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  contenu: string;

  @ManyToOne(() => User, (user) => user.commentaires, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'auteur_id' })
  auteur: User;

  @Column({ name: 'auteur_id' })
  auteurId: number;

  @ManyToOne(() => Article, (article) => article.commentaires, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column({ name: 'article_id' })
  articleId: number;

  @CreateDateColumn()
  createdAt: Date;
}
```

```typescript
// === entities/tag.entity.ts ===
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
} from 'typeorm';
import { Article } from './article.entity';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  nom: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  couleur: string;

  @ManyToMany(() => Article, (article) => article.tags)
  articles: Article[];
}
```

---

## 9. Schema de la base de donnees

Voici le schema resultant des entites definies ci-dessus :

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   users      │     │   articles    │     │    tags      │
├─────────────┤     ├──────────────┤     ├─────────────┤
│ id (PK)      │◄────│ auteur_id(FK) │     │ id (PK)      │
│ nom          │     │ id (PK)       │     │ nom          │
│ email        │     │ titre         │     │ description  │
│ motDePasse   │     │ slug          │     │ couleur      │
│ role         │     │ resume        │     └──────┬──────┘
│ actif        │     │ contenu       │            │
│ createdAt    │     │ statut        │     ┌──────┴──────┐
│ updatedAt    │     │ nombreVues    │     │ article_tag  │
│ deletedAt    │     │ createdAt     │     ├─────────────┤
└──────┬──────┘     │ updatedAt     │     │ article_id   │
       │            └──────┬───────┘     │ tag_id       │
       │                   │              └─────────────┘
┌──────┴──────┐     ┌──────┴───────┐
│  profiles    │     │  comments     │
├─────────────┤     ├──────────────┤
│ id (PK)      │     │ id (PK)       │
│ userId (FK)  │     │ contenu       │
│ bio          │     │ auteur_id(FK) │
│ avatar       │     │ article_id(FK)│
│ siteWeb      │     │ createdAt     │
│ twitter      │     └──────────────┘
│ github       │
└─────────────┘
```

---

## 10. Exercices pratiques

### Exercice 1 : E-commerce

Creez les entites suivantes : `Category` (id, nom, description), `Product` (id, nom, prix, stock, description), `ProductImage` (id, url, alt). Relations : une categorie a plusieurs produits (ManyToOne), un produit a plusieurs images (OneToMany).

### Exercice 2 : Relations avancees

Ajoutez a l'exercice 1 : une relation ManyToMany entre Product et Tag, un Profile sur le User avec OneToOne, et implementez le soft delete sur Product.

### Exercice 3 : Service CRUD

Creez un `ProductsService` complet avec les methodes : create, findAll (avec pagination), findOne (avec relations), update, remove, softRemove, restore.

---

## Liens

| Ressource | Lien |
|-----------|------|
| Quiz Module 14 | `quiz/14-quiz.md` |
| Lab Module 14 | `labs/14-lab-typeorm-entites.md` |
| Screencast | `screencasts/14-screencast.md` |
| Module precedent | [Module 13 — Pipes, Guards, Interceptors](13-nestjs-pipes-guards-interceptors.md) |
| Module suivant | [Module 15 — TypeORM Requetes & Migrations](15-typeorm-requetes-migrations.md) |
| Documentation TypeORM | https://typeorm.io/ |
| @nestjs/typeorm | https://docs.nestjs.com/techniques/database |
| TypeORM Relations | https://typeorm.io/relations |
