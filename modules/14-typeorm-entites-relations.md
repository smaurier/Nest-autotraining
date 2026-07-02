---
titre: TypeORM entités et relations
cours: 09-nestjs
notions: [configuration TypeORM avec NestJS, décorateur Entity et colonnes, clé primaire générée, relations OneToMany ManyToOne ManyToMany OneToOne, chargement eager et lazy, cascade, pattern repository, injection du repository]
outcomes: [définir des entités TypeORM avec colonnes typées, modéliser des relations entre entités, injecter et utiliser un repository dans un service, choisir eager vs lazy]
prerequis: [13-nestjs-pipes-guards-interceptors]
next: 15-typeorm-requetes-migrations
libs: [{ name: typeorm, version: "^0.3" }, { name: "@nestjs/typeorm", version: "^11" }]
tribuzen: entités TypeORM de TribuZen (User, Family, Post, Invitation) et leurs relations
last-reviewed: 2026-07
---

# TypeORM entités et relations

> **Outcomes — tu sauras FAIRE :** définir des entités TypeORM avec colonnes typées, modéliser des relations OneToMany/ManyToOne/ManyToMany/OneToOne entre entités, injecter et utiliser un repository dans un service NestJS, choisir entre eager, lazy et chargement explicite.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

TribuZen doit persister ses `User` et ses `Family`. Au module 11, `FamilyService` utilisait un store en mémoire. Dès qu'un utilisateur crée une famille, l'information disparaît au redémarrage — pas d'API viable sans persistance. Tu essaies d'écrire `UsersService` et tu bloques immédiatement :

```ts
// ❌ tentative naïve — état volatile, pas de DB
@Injectable()
export class UsersService {
  private users: User[] = []            // perdu au redémarrage
  // Comment retrouver les User d'une Family ?
  // Comment faire un findOne par email sans scanner tout le tableau ?
  // Comment modéliser qu'un User appartient à une Family ?
}
```

TypeORM + NestJS résolvent ça avec trois briques : `@Entity()` décrit la table, le repository exécute les requêtes, `TypeOrmModule.forFeature()` injecte le repository dans le service.

```ts
// ✅ avec TypeORM — persistant, relationnel
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,  // NestJS injecte le repository
  ) {}

  findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } })
  }

  findWithFamily(id: number) {
    return this.userRepo.findOne({ where: { id }, relations: { family: true } })
  }
}
```

Ce module explique comment passer de là à un modèle complet avec User, Family, Post et Invitation.

## 2. Théorie complète, concise

### 2.1 Configuration TypeORM dans NestJS

TypeORM 0.3 introduit le concept de `DataSource` (remplace `Connection`). `@nestjs/typeorm` 11 l'encapsule dans `TypeOrmModule`.

**Installation**

```bash
npm install @nestjs/typeorm typeorm pg
```

**`forRoot` — configuration synchrone (dev simple)**

```ts
// app.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'tribuzen',
      // ✅ préférer la liste explicite à un glob sur Windows
      entities: [User, Family, Post, Invitation],
      synchronize: true,  // ⚠️ dev uniquement — migrations en prod (module 15)
      autoLoadEntities: true,
    }),
  ],
})
export class AppModule {}
```

**`forRootAsync` — configuration via ConfigService (recommandé)**

```ts
// app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 5432),
        username: cfg.get<string>('DB_USER', 'postgres'),
        password: cfg.get<string>('DB_PASS', 'postgres'),
        database: cfg.get<string>('DB_NAME', 'tribuzen'),
        autoLoadEntities: true,
        synchronize: cfg.get('NODE_ENV') !== 'production',
      }),
    }),
  ],
})
export class AppModule {}
```

**`forFeature` — enregistrer les entités dans un module**

Chaque feature module déclare les entités qu'il possède. Cela génère les providers de repository injectables.

```ts
// users/users.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from './user.entity'

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
```

### 2.2 `@Entity` et colonnes

**Déclarer une table**

```ts
import { Entity } from 'typeorm'

@Entity()                          // table 'user' (nom de classe en minuscule)
export class User {}

@Entity('family_members')          // nom personnalisé
export class User {}
```

**Clés primaires**

```ts
import { Entity, PrimaryGeneratedColumn, PrimaryColumn } from 'typeorm'

@Entity()
export class User {
  @PrimaryGeneratedColumn()        // SERIAL / AUTO_INCREMENT — entier séquentiel
  id: number

  // OU
  @PrimaryGeneratedColumn('uuid')  // UUID v4 — recommandé pour les API publiques
  id: string

  // OU
  @PrimaryColumn()                 // clé manuelle (ex : code pays 'FR')
  code: string
}
```

**Types de colonnes courants**

```ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ length: 100 })            // varchar(100) — défaut varchar(255)
  name: string

  @Column({ unique: true })           // contrainte UNIQUE
  email: string

  @Column({ select: false })          // exclu des SELECT par défaut
  passwordHash: string

  @Column({ type: 'text', nullable: true })
  bio: string | null

  @Column({ type: 'boolean', default: true })
  isActive: boolean

  @Column({ type: 'enum', enum: ['owner', 'member', 'guest'], default: 'member' })
  role: string

  @Column({ type: 'jsonb', nullable: true })  // PostgreSQL — indexable
  metadata: Record<string, unknown> | null
}
```

**Colonnes de dates automatiques**

```ts
import { CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'

@Entity()
export class Post {
  @CreateDateColumn()    // défini une seule fois à la création
  createdAt: Date

  @UpdateDateColumn()    // mis à jour automatiquement à chaque save()
  updatedAt: Date

  @DeleteDateColumn()    // null = actif ; date = soft-deleted
  deletedAt: Date | null
}
```

### 2.3 Relations

#### `@ManyToOne` / `@OneToMany` — relation la plus courante

Un `User` appartient à une `Family` ; une `Family` contient plusieurs `User`.
Le côté `@ManyToOne` **possède la clé étrangère** en base. `@OneToMany` ne crée aucune colonne.

```ts
// family.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'
import { User } from './user.entity'

@Entity()
export class Family {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 100 })
  name: string

  @OneToMany(() => User, (user) => user.family)  // pas de colonne en base
  members: User[]
}
```

```ts
// user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { Family } from './family.entity'

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  email: string

  @ManyToOne(() => Family, (family) => family.members, {
    nullable: true,       // un user peut ne pas encore appartenir à une famille
    onDelete: 'SET NULL', // si la famille est supprimée, userId devient NULL
  })
  @JoinColumn({ name: 'family_id' }) // nom explicite de la colonne FK
  family: Family | null

  @Column({ name: 'family_id', nullable: true })
  familyId: string | null
}
```

#### `@OneToOne` / `@JoinColumn` — relation un-à-un

`@JoinColumn()` est **obligatoire sur exactement un côté** — celui qui porte la clé étrangère.

```ts
// invitation.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm'
import { User } from './user.entity'

@Entity()
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  email: string

  @Column({ type: 'timestamp' })
  expiresAt: Date

  @OneToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'accepted_by_user_id' })  // côté propriétaire de la FK
  acceptedBy: User | null
}
```

#### `@ManyToMany` / `@JoinTable` — relation plusieurs-à-plusieurs

Un `Post` peut avoir plusieurs tags ; un tag peut apparaître sur plusieurs posts.
`@JoinTable()` est **obligatoire sur un côté** — il crée la table de liaison.

```ts
// post.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, ManyToMany, JoinTable, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm'
import { User } from './user.entity'
import { Family } from './family.entity'

@Entity()
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 200 })
  title: string

  @Column({ type: 'text' })
  body: string

  @Column({ type: 'enum', enum: ['draft', 'published'], default: 'draft' })
  status: string

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User

  @Column({ name: 'author_id' })
  authorId: string

  @ManyToOne(() => Family, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'family_id' })
  family: Family

  @Column({ name: 'family_id' })
  familyId: string

  // ManyToMany avec table de liaison personnalisée
  @ManyToMany(() => Post, (post) => post.likedBy, { cascade: ['insert'] })
  @JoinTable({
    name: 'post_likes',
    joinColumn: { name: 'post_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  likedBy: User[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
```

**Tableau récapitulatif des relations**

| Relation | Côté propriétaire | Côté inverse | Colonne en base |
|---|---|---|---|
| OneToOne | `@OneToOne` + `@JoinColumn` | `@OneToOne` | FK sur le côté `@JoinColumn` |
| ManyToOne | `@ManyToOne` | `@OneToMany` | FK sur le côté `@ManyToOne` |
| ManyToMany | `@ManyToMany` + `@JoinTable` | `@ManyToMany` | Table de liaison |

### 2.4 Chargement des relations — eager, lazy, explicite

**Eager — chargement automatique systématique**

```ts
@ManyToOne(() => Family, { eager: true })   // family toujours chargée avec user
family: Family | null
```

**Lazy — chargement à la demande via Promise**

```ts
@OneToMany(() => Post, (post) => post.author, { lazy: true })
posts: Promise<Post[]>           // type = Promise<> — la requête SQL est différée

// utilisation
const posts = await user.posts   // SQL exécuté ici seulement
```

**Explicite avec `relations` — recommandé**

```ts
// choisir précisément quoi charger selon le cas d'usage
const user = await userRepo.findOne({
  where: { id },
  relations: {
    family: true,        // charge la family
    family: {
      members: true,     // charge aussi les membres de la family (imbriqué)
    },
  },
})
```

Règle : préférer le chargement explicite — `eager` charge inutilement à chaque requête, `lazy` est difficile à tracer et peut déclencher le problème N+1.

### 2.5 Cascade

Les cascades propagent les opérations TypeORM aux entités liées.

```ts
@OneToMany(() => Post, (post) => post.author, {
  cascade: ['insert', 'update'],  // OU cascade: true pour tout activer
})
posts: Post[]

// avec cascade: true, un save() sur User persist aussi les posts modifiés
const user = userRepo.create({ email: 'alice@tribu.fr', name: 'Alice' })
user.posts = [postRepo.create({ title: 'Bienvenue', body: '...' })]
await userRepo.save(user)   // persiste user ET son post en une transaction
```

Cascades disponibles : `'insert'`, `'update'`, `'remove'`, `'soft-remove'`, `'recover'`. `cascade: true` active toutes.

### 2.6 Pattern repository

**Injection du repository**

```ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from './user.entity'

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}
}
```

**Méthodes clés du repository**

```ts
// Créer : create() instancie en mémoire, save() persiste
const user = this.userRepo.create({ email, name })
await this.userRepo.save(user)

// Lire
await this.userRepo.find({ where: { isActive: true }, order: { createdAt: 'DESC' } })
await this.userRepo.findOne({ where: { email }, relations: { family: true } })

// Mettre à jour : preload() charge + fusionne, save() persiste
const user = await this.userRepo.preload({ id, ...dto })

// Supprimer (hard)
await this.userRepo.remove(user)          // charge l'entité, déclenche les hooks
await this.userRepo.delete(id)            // SQL direct, pas de hooks

// Soft delete (nécessite @DeleteDateColumn)
await this.userRepo.softRemove(user)
await this.userRepo.restore(id)
```

| Méthode | Charge l'entité | Hooks / cascade | Usage |
|---|---|---|---|
| `save()` | Oui (si entité existante) | Oui | Création ou mise à jour |
| `update(id, data)` | Non | Non | Mise à jour rapide sans charger |
| `remove(entity)` | Non (déjà chargée) | Oui | Suppression après chargement |
| `delete(id)` | Non | Non | Suppression SQL directe |
| `softRemove(entity)` | Non | Oui | Soft delete après chargement |

## 3. Worked examples

### Exemple A — UserService CRUD avec relation Family

```ts
// src/users/user.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm'
import { Family } from '../families/family.entity'

export enum UserRole {
  OWNER = 'owner',
  MEMBER = 'member',
  GUEST = 'guest',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 100 })
  name: string

  @Column({ unique: true })
  email: string

  @Column({ select: false })       // exclu des SELECT — ne jamais exposer dans les réponses API
  passwordHash: string

  @Column({ type: 'enum', enum: UserRole, default: UserRole.GUEST })
  role: UserRole

  @Column({ default: true })
  isActive: boolean

  // FK vers Family — nullable car un User peut ne pas encore avoir de famille
  @ManyToOne(() => Family, (family) => family.members, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'family_id' })
  family: Family | null

  @Column({ name: 'family_id', nullable: true })
  familyId: string | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
```

```ts
// src/families/family.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'
import { User } from '../users/user.entity'

@Entity('families')
export class Family {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 100, unique: true })
  name: string

  @Column({ type: 'int', default: 12 })
  maxSize: number

  // Côté inverse — pas de colonne en base
  @OneToMany(() => User, (user) => user.family)
  members: User[]
}
```

```ts
// src/users/users.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from './user.entity'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'

@Module({
  imports: [TypeOrmModule.forFeature([User])],   // génère le provider Repository<User>
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
```

```ts
// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from './user.entity'

export interface CreateUserDto { name: string; email: string; passwordHash: string }
export interface UpdateUserDto { name?: string; isActive?: boolean }

@Injectable()
export class UsersService {
  constructor(
    // @InjectRepository() est obligatoire — le token est généré par forFeature([User])
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    // create() applique les valeurs par défaut et les transformations de l'entité
    const user = this.userRepo.create(dto)
    return this.userRepo.save(user)
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find({
      relations: { family: true },
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: { family: true },
    })
    // Lever une exception métier — le controller n'a pas à vérifier
    if (!user) throw new NotFoundException(`User ${id} introuvable`)
    return user
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    // preload() charge l'entité existante et fusionne dto — lève rien si absent
    const user = await this.userRepo.preload({ id, ...dto })
    if (!user) throw new NotFoundException(`User ${id} introuvable`)
    return this.userRepo.save(user)
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id)   // vérifie l'existence + déclenche les hooks
    await this.userRepo.remove(user)
  }

  async joinFamily(userId: string, familyId: string): Promise<User> {
    // update() SQL direct — pas de chargement, pas de hooks
    await this.userRepo.update(userId, { familyId })
    return this.findOne(userId)
  }
}
```

**Pas-à-pas :** (1) `@Entity('users')` — nom de table explicite, pas de surprise ; (2) `@ManyToOne` + `@JoinColumn({ name: 'family_id' })` sur `User` — c'est lui qui porte la FK `family_id` ; (3) `@OneToMany` sur `Family` — côté inverse, aucune colonne créée ; (4) `TypeOrmModule.forFeature([User])` dans `UsersModule` — génère le provider `getRepositoryToken(User)` injectable via `@InjectRepository(User)` ; (5) `create()` avant `save()` — instancie l'entité correctement avec les valeurs par défaut avant la persistance.

### Exemple B — Post avec ManyToMany et Invitation OneToOne

```ts
// src/posts/post.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, ManyToMany, JoinTable, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm'
import { User } from '../users/user.entity'
import { Family } from '../families/family.entity'

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 200 })
  title: string

  @Column({ type: 'text' })
  body: string

  @Column({ type: 'enum', enum: ['draft', 'published'], default: 'draft' })
  status: 'draft' | 'published'

  // Auteur — suppression de l'auteur supprime ses posts
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User

  @Column({ name: 'author_id' })
  authorId: string

  // Famille à laquelle appartient ce post
  @ManyToOne(() => Family, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'family_id' })
  family: Family

  @Column({ name: 'family_id' })
  familyId: string

  // Membres qui ont liké ce post — table de liaison 'post_likes'
  @ManyToMany(() => User, { cascade: false })
  @JoinTable({
    name: 'post_likes',
    joinColumn: { name: 'post_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  likedBy: User[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
```

```ts
// src/invitations/invitation.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToOne, JoinColumn,
} from 'typeorm'
import { User } from '../users/user.entity'
import { Family } from '../families/family.entity'

@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  email: string

  @Column({ type: 'enum', enum: ['pending', 'accepted', 'expired'], default: 'pending' })
  status: 'pending' | 'accepted' | 'expired'

  @Column({ type: 'timestamp' })
  expiresAt: Date

  // Famille qui invite
  @ManyToOne(() => Family, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'family_id' })
  family: Family

  @Column({ name: 'family_id' })
  familyId: string

  // Utilisateur qui a envoyé l'invitation
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invited_by_id' })
  invitedBy: User

  @Column({ name: 'invited_by_id' })
  invitedById: string

  // OneToOne — l'invitation lie un seul User qui l'accepte
  @OneToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'accepted_by_id' })
  acceptedBy: User | null

  @Column({ name: 'accepted_by_id', nullable: true })
  acceptedById: string | null
}
```

**Pas-à-pas :** (1) `@ManyToMany` avec `@JoinTable` sur `Post.likedBy` — `@JoinTable` crée la table `post_likes` ; le côté `User` n'a pas de `@JoinTable` ; (2) `cascade: false` sur ManyToMany — on ne veut pas créer de User lors du save d'un Post ; (3) `@OneToOne` sur `Invitation.acceptedBy` — `@JoinColumn` sur le côté Invitation, donc Invitation porte la FK `accepted_by_id` ; (4) `nullable: true` sur `acceptedBy` — l'invitation peut être en attente sans utilisateur associé.

## 4. Pièges & misconceptions

- **`@OneToMany` sans `@ManyToOne`.** `@OneToMany` ne crée aucune colonne en base. Si tu places uniquement `@OneToMany` sans le `@ManyToOne` correspondant, TypeORM ne génère aucune clé étrangère — les relations ne peuvent pas être persistées. Toujours déclarer les deux côtés.

- **`@JoinColumn` absent sur un `@OneToOne`.** `@JoinColumn()` est obligatoire sur exactement un côté d'une relation `@OneToOne`. Sans lui, TypeORM lève une erreur au démarrage. Le côté qui le porte crée la colonne FK.

- **`@JoinTable` absent ou dupliqué sur un `@ManyToMany`.** `@JoinTable()` doit être présent sur **un seul côté** de la relation ManyToMany. Le placer sur les deux côtés crée deux tables de liaison distinctes. Le côté propriétaire est celui qui porte `@JoinTable`.

- **Problème N+1 avec chargement implicite.** Charger une liste de `User` puis accéder à `user.family` dans une boucle génère N+1 requêtes SQL. Solution : charger la relation dès le `find()` via `relations: { family: true }` ou utiliser le QueryBuilder avec `leftJoinAndSelect` (module 15).

- **`save()` sur un objet créé sans `create()`.** `userRepo.save({ email, name })` fonctionnera mais bypasse les valeurs par défaut définies dans l'entité et les éventuels abonnés TypeORM. Toujours `userRepo.create(dto)` puis `save()`.

- **`eager: true` sur des relations lourdes.** Une relation `eager` est chargée à **chaque** `find()` sur cette entité — même quand tu n'en as pas besoin. Sur un `User` avec des centaines de `Post`, cela dégrade les performances de toutes les requêtes. Réserver `eager` aux relations très légères et quasiment toujours utiles.

- **`synchronize: true` en production.** `synchronize: true` exécute des `ALTER TABLE` automatiques au démarrage pour correspondre à tes entités. En production, cela peut supprimer des colonnes ou des données. Toujours `synchronize: false` en prod et utiliser les migrations (module 15).

## 5. Ancrage TribuZen

Couche fil-rouge : **entités TypeORM de TribuZen (User, Family, Post, Invitation) et leurs relations** (`smaurier/tribuzen`).

- `User` porte `@ManyToOne(() => Family)` avec FK `family_id` — un utilisateur appartient à une famille ou est sans famille (`nullable: true`, `onDelete: 'SET NULL'`). La `Family` a `@OneToMany(() => User)` côté inverse.
- `Post` a `@ManyToOne(() => User)` pour l'auteur et `@ManyToOne(() => Family)` pour le fil familial. La relation `likedBy` utilise `@ManyToMany(() => User)` + `@JoinTable` avec table `post_likes`.
- `Invitation` utilise `@OneToOne(() => User)` pour `acceptedBy` — une invitation ne peut être acceptée que par un seul utilisateur. Elle porte aussi deux `@ManyToOne` : la famille invitante et l'utilisateur qui a envoyé l'invitation.
- `TypeOrmModule.forFeature([User])` dans `UsersModule`, `TypeOrmModule.forFeature([Family])` dans `FamiliesModule`, etc. — chaque module possède et exporte son repository via son service.
- `UsersService` injecte `Repository<User>` via `@InjectRepository(User)` — remplace l'ancien store en mémoire du module 11 sans changer l'interface du service.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  users/
    user.entity.ts          ← @Entity, @PrimaryGeneratedColumn('uuid'), @ManyToOne Family
    users.module.ts          ← TypeOrmModule.forFeature([User])
    users.service.ts         ← @InjectRepository(User)
  families/
    family.entity.ts         ← @Entity, @OneToMany Users
    families.module.ts
    families.service.ts
  posts/
    post.entity.ts           ← @ManyToOne User+Family, @ManyToMany likedBy
    posts.module.ts
    posts.service.ts
  invitations/
    invitation.entity.ts     ← @OneToOne acceptedBy, @ManyToOne family+invitedBy
    invitations.module.ts
    invitations.service.ts
```

## 6. Points clés

1. `TypeOrmModule.forRoot()` initialise la connexion (DataSource) une fois dans `AppModule` ; `forRootAsync()` permet d'injecter `ConfigService` pour lire `.env`.
2. `TypeOrmModule.forFeature([MyEntity])` dans chaque feature module génère le provider `Repository<MyEntity>` injectable via `@InjectRepository(MyEntity)`.
3. `@Entity()` déclare une table ; `@PrimaryGeneratedColumn('uuid')` génère un UUID v4 ; `@Column({ select: false })` exclut une colonne des SELECT.
4. `@ManyToOne` porte toujours la clé étrangère ; `@OneToMany` est le côté inverse sans colonne. `@JoinColumn({ name })` personnalise le nom de la FK.
5. `@OneToOne` requiert `@JoinColumn()` sur exactement un côté — celui qui crée la FK.
6. `@ManyToMany` requiert `@JoinTable()` sur exactement un côté — celui qui crée la table de liaison.
7. Préférer le chargement explicite `relations: { relation: true }` à `eager: true` (trop large) ou `lazy` (risque N+1 invisible).
8. `create()` instancie en mémoire avec les défauts ; `save()` persiste. `update()` et `delete()` sont des SQL directs sans hooks.

## 7. Seeds Anki

```
Quel côté d'une relation @ManyToOne/@OneToMany porte la clé étrangère ?|Le côté @ManyToOne — @OneToMany est le côté inverse et ne crée aucune colonne en base
Pourquoi @JoinColumn() est-il obligatoire sur @OneToOne ?|TypeORM doit savoir quel côté de la relation possède la colonne FK — sans @JoinColumn sur un des deux côtés, il lève une erreur au démarrage
Quel décorateur crée la table de liaison d'une relation ManyToMany ?|@JoinTable() — à placer sur exactement un des deux côtés de la relation @ManyToMany
Différence entre save() et update() dans un Repository TypeORM ?|save() charge/instancie l'entité, déclenche les hooks et les cascades ; update() exécute un SQL UPDATE direct sans charger l'entité ni déclencher les hooks
Pourquoi préférer le chargement explicite (relations: {}) à eager: true ?|eager: true charge la relation à chaque find() même quand on n'en a pas besoin — le chargement explicite permet de contrôler précisément ce qui est récupéré selon le cas d'usage
Pourquoi appeler create() avant save() plutôt que save() directement sur un POJO ?|create() applique les valeurs par défaut définies dans l'entité et déclenche les transformations TypeORM — save() sur un POJO brut les bypasse
Comment rendre une entité disponible pour injection dans un module NestJS ?|TypeOrmModule.forFeature([MyEntity]) dans le @Module().imports génère le provider Repository<MyEntity> injectable via @InjectRepository(MyEntity)
Quel est le danger de synchronize: true en production ?|TypeORM exécute des ALTER TABLE automatiques au démarrage pour correspondre aux entités — cela peut supprimer des colonnes ou des données sans avertissement
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-14-typeorm-entites/README.md`. Tu y crées les entités User, Family et Post de TribuZen avec leurs relations, tu implémentes les services avec le repository pattern, et tu vérifies les endpoints manuellement avec `curl`. Corrigé complet commenté + variante J+30 dans le README du lab.

---

| Navigation | |
|---|---|
| Précédent | [Module 13 — Pipes, Guards, Interceptors](13-nestjs-pipes-guards-interceptors.md) |
| Suivant | [Module 15 — TypeORM Requêtes et Migrations](15-typeorm-requetes-migrations.md) |
