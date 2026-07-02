# Lab 14 — TypeORM entités et relations

> **Outcome :** à la fin, tu sais définir des entités TypeORM avec colonnes typées, modéliser des relations OneToMany/ManyToOne/ManyToMany entre entités TribuZen, et injecter un repository dans un service NestJS 11.
> **Vrai outil :** TypeORM `^0.3`, `@nestjs/typeorm` `^11`, PostgreSQL (ou SQLite en mémoire pour les tests).
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu construis les entités persistantes de TribuZen dans un projet NestJS 11 existant. Pas de gap-fill — tu écris tout de A à Z à partir du squelette fourni dans `src/`.

Objectif fonctionnel :

- `POST /users` → crée un utilisateur (name, email)
- `GET /users` → liste tous les utilisateurs avec leur famille
- `GET /users/:id` → retourne un utilisateur avec sa famille
- `POST /families` → crée une famille (name)
- `GET /families/:id` → retourne une famille avec ses membres
- `POST /posts` → crée un post lié à un auteur et une famille
- `GET /posts` → liste tous les posts avec auteur et famille

## Étapes (en friction)

1. **Entité `Family`** — crée `src/families/family.entity.ts` avec `@Entity('families')`, `@PrimaryGeneratedColumn('uuid')`, `@Column({ length: 100, unique: true }) name`, `@Column({ type: 'int', default: 12 }) maxSize`. Ajoute `@OneToMany(() => User, user => user.family) members: User[]` côté inverse (pas de FK ici). Enregistre dans `FamiliesModule` via `TypeOrmModule.forFeature([Family])`.

2. **Entité `User` avec FK vers `Family`** — crée `src/users/user.entity.ts`. Ajoute `@ManyToOne(() => Family, family => family.members, { nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'family_id' }) family: Family | null` et `@Column({ name: 'family_id', nullable: true }) familyId: string | null`. Ajoute aussi `@Column({ select: false }) passwordHash: string`, `@Column({ type: 'enum', enum: ['owner','member','guest'], default: 'guest' }) role: string` et les colonnes de dates automatiques.

3. **Entité `Post`** — crée `src/posts/post.entity.ts`. Relie `Post` à `User` (auteur, `onDelete: 'CASCADE'`) et à `Family` (fil familial, `onDelete: 'CASCADE'`) via deux `@ManyToOne`. Ajoute un `@ManyToMany(() => User) @JoinTable({ name: 'post_likes', ... }) likedBy: User[]` pour les likes. Enregistre dans `PostsModule`.

4. **`UsersService`** — injecte `@InjectRepository(User)` et implémente `create(dto)`, `findAll()` avec `relations: { family: true }`, `findOne(id)` avec `NotFoundException`, `update(id, dto)` via `preload()` + `save()`, et `joinFamily(userId, familyId)` via `update()`.

5. **`FamiliesService` et `PostsService`** — implémenter un `findOne` qui charge les relations (`members` pour Family, `author` + `family` pour Post). Créer les controllers avec les routes décrites dans l'énoncé.

6. **Vérification** — démarre l'app (`npm run start:dev`), crée une famille via `curl -X POST http://localhost:3000/families -H 'Content-Type: application/json' -d '{"name":"Martin"}'`, puis crée un user et appelle `GET /families/:id` pour vérifier que `members` est rempli.

## Corrigé complet commenté

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

  // Côté inverse de @ManyToOne sur User — pas de colonne FK ici
  @OneToMany(() => User, (user) => user.family)
  members: User[]
}
```

```ts
// src/users/user.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm'
import { Family } from '../families/family.entity'

export enum UserRole { OWNER = 'owner', MEMBER = 'member', GUEST = 'guest' }

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 100 })
  name: string

  @Column({ unique: true })
  email: string

  // select: false = jamais inclus dans les SELECT par défaut
  @Column({ select: false })
  passwordHash: string

  @Column({ type: 'enum', enum: UserRole, default: UserRole.GUEST })
  role: UserRole

  @Column({ default: true })
  isActive: boolean

  // Côté propriétaire de la relation — porte la FK family_id
  @ManyToOne(() => Family, (family) => family.members, {
    nullable: true,
    onDelete: 'SET NULL',  // si la famille est supprimée, on ne supprime pas l'user
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

  // Auteur — suppression de l'auteur supprime ses posts (CASCADE)
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

  // ManyToMany — @JoinTable sur ce côté = côté propriétaire de la table de liaison
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
// src/users/users.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from './user.entity'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'

@Module({
  imports: [TypeOrmModule.forFeature([User])],  // génère le provider Repository<User>
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

export interface CreateUserDto { name: string; email: string }
export interface UpdateUserDto { name?: string; isActive?: boolean }

@Injectable()
export class UsersService {
  constructor(
    // @InjectRepository() résout le token généré par forFeature([User])
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    // create() instancie l'entité avec les valeurs par défaut (role, isActive)
    const user = this.userRepo.create(dto)
    return this.userRepo.save(user)
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find({
      relations: { family: true },     // charge la family en une seule requête JOIN
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: { family: true },
    })
    if (!user) throw new NotFoundException(`User ${id} introuvable`)
    return user
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    // preload() charge l'entité existante et fusionne dto — retourne undefined si absent
    const user = await this.userRepo.preload({ id, ...dto })
    if (!user) throw new NotFoundException(`User ${id} introuvable`)
    return this.userRepo.save(user)
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id)   // findOne vérifie l'existence
    await this.userRepo.remove(user)      // remove() déclenche les hooks TypeORM
  }

  async joinFamily(userId: string, familyId: string): Promise<User> {
    // update() = SQL direct, pas de chargement — adapté pour une mise à jour ciblée
    await this.userRepo.update(userId, { familyId })
    return this.findOne(userId)
  }
}
```

```ts
// src/families/families.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Family } from './family.entity'

@Injectable()
export class FamiliesService {
  constructor(
    @InjectRepository(Family)
    private readonly familyRepo: Repository<Family>,
  ) {}

  async create(dto: { name: string; maxSize?: number }): Promise<Family> {
    const family = this.familyRepo.create(dto)
    return this.familyRepo.save(family)
  }

  async findOne(id: string): Promise<Family> {
    const family = await this.familyRepo.findOne({
      where: { id },
      relations: { members: true },  // charge les membres — évite le N+1 côté appelant
    })
    if (!family) throw new NotFoundException(`Family ${id} introuvable`)
    return family
  }

  async isFull(id: string): Promise<boolean> {
    const family = await this.findOne(id)
    // Règle métier TribuZen — nombre de membres réels vs capacité max
    return family.members.length >= family.maxSize
  }
}
```

## Variante J+30 (fading)

Même exercice, sans consulter le corrigé. Contraintes supplémentaires :

1. Ajoute une entité `Invitation` avec une relation `@OneToOne(() => User)` pour `acceptedBy` (nullable) et deux `@ManyToOne` : la famille invitante et l'utilisateur qui a envoyé l'invitation. Le champ `status` est un enum `'pending' | 'accepted' | 'expired'` avec valeur par défaut `'pending'`. Implémente `accept(invitationId, userId)` dans `InvitationsService`.

2. Ajoute le soft delete sur `Post` : `@DeleteDateColumn() deletedAt: Date | null`. Implémente `softRemove(id)` et `restore(id)` dans `PostsService`. Vérifie qu'un `findAll()` normal exclut automatiquement les posts soft-deleted.

3. Dans `FamiliesService.isFull()`, évite de charger tous les membres en mémoire — utilise `this.userRepo.count({ where: { familyId: id } })` à la place. Compare les performances sur une famille avec 1000 membres.

Temps cible : 40 minutes sans le corrigé.

## Application TribuZen

Commit cible dans `smaurier/tribuzen` :

```
feat(entities): User Family Post Invitation — entités TypeORM + relations
```

Fichiers à créer :

- `apps/api/src/families/family.entity.ts`
- `apps/api/src/families/families.module.ts`
- `apps/api/src/families/families.service.ts`
- `apps/api/src/users/user.entity.ts`
- `apps/api/src/users/users.module.ts`
- `apps/api/src/users/users.service.ts`
- `apps/api/src/posts/post.entity.ts`
- `apps/api/src/posts/posts.module.ts`
- `apps/api/src/posts/posts.service.ts`
- `apps/api/src/invitations/invitation.entity.ts`
- `apps/api/src/invitations/invitations.module.ts`

Critère de done :
- `POST /families` crée une famille et retourne son UUID
- `POST /users` avec `{ email, name }` crée un user avec `role: 'guest'` et `familyId: null`
- `PATCH /users/:id/join/:familyId` met à jour `familyId` sur l'user
- `GET /families/:id` retourne la famille avec le tableau `members` rempli (JSON)
- `GET /posts` retourne les posts avec `author.name` et `family.name` inclus
