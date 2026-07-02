# Lab 15 — TypeORM requêtes et migrations

> **Outcome :** à la fin, tu sais écrire des requêtes avec le repository et le QueryBuilder, charger des relations sans N+1, exécuter une transaction, générer et appliquer une migration TypeORM 0.3 dans un projet NestJS.
> **Vrai outil :** TypeORM `^0.3`, NestJS 11, PostgreSQL.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu construis le module `FamilyMemberModule` de TribuZen dans le projet existant (`09-nestjs/labs/lab-15-typeorm-queries`). Les entités `User`, `Post` et `Comment` sont déjà présentes comme point de départ — tu en crées de nouvelles pour TribuZen. Pas de gap-fill : tu écris tout le code de requête de A à Z.

Objectif fonctionnel :

- `GET /families/:id/members` → liste des membres d'une famille, avec `User` chargé, triés par rôle
- `GET /families/:id/members/search?q=alice&page=1&limit=10` → recherche paginée par prénom ou email
- `POST /families/:id/members` → ajouter un membre (transaction : vérification capacité + création + incrément compteur)
- `GET /families/stats` → statistiques par famille (nombre de membres) via agrégat

Et une migration `AddJoinedAt` à générer et appliquer.

## Étapes (en friction)

1. Créer `src/family/entities/family.entity.ts` avec `@Entity()` — colonnes `id` (uuid, primary), `name` (varchar), `memberCount` (int, default 0), `maxSize` (int, default 12). Créer `src/family/entities/family-member.entity.ts` — colonnes `id` (uuid), `familyId` (varchar FK), `userId` (varchar FK), `role` (varchar, default `'member'`), relations `@ManyToOne` vers `Family` et `User` (existant).

2. Créer `src/family/family-member.service.ts` avec `@Injectable()`. Injecter `Repository<FamilyMember>` via `@InjectRepository` et `DataSource`. Implémenter `listMembers(familyId)` avec `find()` + `where`, `relations`, `order`, `select`. Vérifier en lançant l'app que `GET /families/:id/members` retourne un tableau (vide si aucun membre).

3. Implémenter `searchMembers(familyId, search, page, limit)` avec `createQueryBuilder` : `leftJoinAndSelect` sur `user`, `andWhere` ILIKE sur `firstName` et `email`, `orderBy`, `skip`/`take`, `getManyAndCount`. La route retourne `{ data: [...], total: number }`.

4. Implémenter `addMember(familyId, userId)` avec `dataSource.manager.transaction`. Dans le callback `manager` : charger `Family` avec `lock: { mode: 'pessimistic_write' }`, vérifier `memberCount < maxSize` (lever `ConflictException` sinon), vérifier l'absence de doublon, `manager.create` + `manager.save(FamilyMember)`, `manager.increment(Family, ...)`. Toutes les opérations utilisent `manager`, pas `this.memberRepo`.

5. Implémenter `familyStats()` avec QueryBuilder : `select` + `addSelect COUNT`, `groupBy`, `getRawMany`. Route `GET /families/stats`.

6. Ajouter la colonne `joinedAt` (`CreateDateColumn` ou `Column({ type: 'timestamp', default: () => 'now()' })`) à `FamilyMember`. Compiler (`npm run build`) puis générer la migration :

```bash
npm run migration:generate -- src/migrations/AddJoinedAtToMember
```

Vérifier le fichier `up`/`down` généré. Appliquer :

```bash
npm run migration:run
```

Vérifier en base que la colonne existe. Tester `migration:revert` puis réappliquer.

## Corrigé complet commenté

```ts
// src/family/entities/family.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity('families')
export class Family {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Column({ default: 0 })
  memberCount: number

  @Column({ default: 12 })
  maxSize: number
}
```

```ts
// src/family/entities/family-member.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm'
import { Family } from './family.entity'
import { User } from '../../users/user.entity'

@Entity('family_members')
export class FamilyMember {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  familyId: string

  @Column()
  userId: string

  @Column({ default: 'member' })
  role: string

  // Colonne ajoutée par migration — DEFAULT now() remplit les lignes existantes
  @CreateDateColumn()
  joinedAt: Date

  @ManyToOne(() => Family)
  @JoinColumn({ name: 'familyId' })
  family: Family

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User
}
```

```ts
// src/family/family-member.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import { FamilyMember } from './entities/family-member.entity'
import { Family } from './entities/family.entity'

@Injectable()
export class FamilyMemberService {
  constructor(
    @InjectRepository(FamilyMember)
    private readonly memberRepo: Repository<FamilyMember>,
    private readonly dataSource: DataSource,
  ) {}

  // find() + options — une seule requête SQL avec LEFT JOIN, pas de N+1
  async listMembers(familyId: string): Promise<FamilyMember[]> {
    return this.memberRepo.find({
      where: { familyId },
      relations: { user: true },               // TypeORM génère LEFT JOIN users
      order: { role: 'ASC', joinedAt: 'ASC' },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        user: { id: true, firstName: true, email: true }, // colonnes user restreintes
      },
    })
  }

  // QueryBuilder : ILIKE (insensible à la casse) + pagination avec total
  async searchMembers(
    familyId: string,
    search: string,
    page: number,
    limit: number,
  ): Promise<{ data: FamilyMember[]; total: number }> {
    const [data, total] = await this.memberRepo
      .createQueryBuilder('mbr')
      .leftJoinAndSelect('mbr.user', 'user')
      .where('mbr.familyId = :familyId', { familyId })
      // :search apparaît deux fois — TypeORM déduplique automatiquement le paramètre
      .andWhere('user.firstName ILIKE :search OR user.email ILIKE :search', {
        search: `%${search}%`,
      })
      .orderBy('mbr.joinedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount() // retourne [FamilyMember[], number] en une requête
    return { data, total }
  }

  // Transaction atomique : vérification + création + incrément
  async addMember(familyId: string, userId: string): Promise<FamilyMember> {
    return this.dataSource.manager.transaction(async (manager) => {
      // lock pessimistic_write : empêche deux requêtes concurrentes de lire le même memberCount
      const family = await manager.findOne(Family, {
        where: { id: familyId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!family) throw new NotFoundException(`Famille ${familyId} introuvable`)
      if (family.memberCount >= family.maxSize) {
        throw new ConflictException(`Famille ${familyId} complète (${family.maxSize} membres max)`)
      }

      const existing = await manager.findOne(FamilyMember, {
        where: { familyId, userId },
      })
      if (existing) throw new ConflictException(`Utilisateur ${userId} est déjà membre`)

      // Utiliser manager, jamais this.memberRepo — seul manager partage la transaction
      const member = manager.create(FamilyMember, {
        familyId,
        userId,
        role: 'member',
      })
      const saved = await manager.save(member)

      // increment émet UPDATE ... SET memberCount = memberCount + 1 sans charger l'entité
      await manager.increment(Family, { id: familyId }, 'memberCount', 1)

      return saved
      // Si une erreur est levée : ROLLBACK automatique — aucune ligne n'est persistée
    })
  }

  // getRawMany : agrégat GROUP BY — impossible avec find()
  async familyStats(): Promise<{ familyId: string; memberCount: string }[]> {
    return this.memberRepo
      .createQueryBuilder('mbr')
      .select('mbr.familyId', 'familyId')       // alias explicite pour contrôler le nom
      .addSelect('COUNT(mbr.id)', 'memberCount') // COUNT retourne string en PostgreSQL
      .groupBy('mbr.familyId')
      .orderBy('memberCount', 'DESC')
      .getRawMany() // objets bruts — pas d'instances FamilyMember
  }
}
```

```ts
// src/family/family-member.controller.ts
import { Controller, Get, Post, Param, Query, Body, ParseIntPipe, DefaultValuePipe } from '@nestjs/common'
import { FamilyMemberService } from './family-member.service'

@Controller('families')
export class FamilyMemberController {
  constructor(private readonly service: FamilyMemberService) {}

  @Get('stats')
  stats() {
    return this.service.familyStats()
  }

  @Get(':id/members')
  list(@Param('id') id: string) {
    return this.service.listMembers(id)
  }

  @Get(':id/members/search')
  search(
    @Param('id') id: string,
    @Query('q') q: string = '',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.service.searchMembers(id, q, page, limit)
  }

  @Post(':id/members')
  add(@Param('id') familyId: string, @Body('userId') userId: string) {
    return this.service.addMember(familyId, userId)
  }
}
```

```ts
// src/family/family.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Family } from './entities/family.entity'
import { FamilyMember } from './entities/family-member.entity'
import { FamilyMemberService } from './family-member.service'
import { FamilyMemberController } from './family-member.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([Family, FamilyMember]),
    // DataSource est disponible globalement via TypeOrmModule.forRoot
  ],
  controllers: [FamilyMemberController],
  providers: [FamilyMemberService],
})
export class FamilyModule {}
```

## Variante J+30 (fading)

Même exercice, sans consulter le corrigé. Contraintes supplémentaires :

1. Remplacer `listMembers` par une version QueryBuilder qui charge également la relation `family` (pas seulement `user`). Utiliser `leftJoin` (sans `Select`) pour `family` et `leftJoinAndSelect` pour `user` — comprendre la différence en inspectant le SQL généré (`{ logging: true }` dans le DataSource).

2. Dans `addMember`, remplacer `manager.transaction` par un `QueryRunner` avec niveau d'isolation `REPEATABLE READ`. Implémenter le try/catch/finally avec `release()`. Observer la différence de verbosité.

3. Ajouter une colonne `invitedBy` (uuid nullable) à `FamilyMember`. Générer la migration `AddInvitedByToMember`. Vérifier le `down()` avec `migration:revert`. Ne pas oublier de rebuilder avant de générer.

Temps cible : 40 minutes sans le corrigé.

## Application TribuZen

Commit cible dans `smaurier/tribuzen` :

```
feat(family): membres — requêtes repository+QB, transaction addMember, migration joinedAt
```

Fichiers à créer :

- `apps/api/src/family/entities/family.entity.ts`
- `apps/api/src/family/entities/family-member.entity.ts`
- `apps/api/src/family/family-member.service.ts`
- `apps/api/src/family/family-member.controller.ts`
- `apps/api/src/family/family.module.ts`
- `apps/api/src/migrations/1720000000000-AddJoinedAtToMember.ts`
- `apps/api/data-source.ts`

Critère de done : `GET /families/:id/members` retourne la liste avec `user` chargé, `POST /families/:id/members` rejette avec 409 si la famille est pleine, `migration:revert` + `migration:run` cycle sans erreur.
