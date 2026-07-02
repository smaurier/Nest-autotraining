---
titre: TypeORM requêtes et migrations
cours: 09-nestjs
notions: [méthodes du repository find et save, options de requête where relations order, QueryBuilder, chargement des relations, transactions, migrations generate run revert, seeding de données]
outcomes: [écrire des requêtes avec le repository et le QueryBuilder, charger des relations, exécuter une transaction, générer et appliquer des migrations]
prerequis: [14-typeorm-entites-relations]
next: 16-prisma-schema-client
libs: [{ name: typeorm, version: "^0.3" }]
tribuzen: requêtes et migrations de la base TribuZen (lister les membres d'une famille, migration du schéma)
last-reviewed: 2026-07
---

# TypeORM requêtes et migrations

> **Outcomes — tu sauras FAIRE :** écrire des requêtes avec le repository et le QueryBuilder, charger des relations sans N+1, exécuter une transaction, générer et appliquer des migrations TypeORM 0.3.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

TribuZen doit afficher la liste des membres d'une famille triée par rôle — avec leur prénom, email et la date où ils ont rejoint. Trois problèmes immédiats :

```ts
// ❌ tentative naïve — deux problèmes
const memberships = await memberRepo.find()          // charge TOUS les membres, toutes familles
for (const m of memberships) {
  m.user = await userRepo.findOne({ where: { id: m.userId } }) // N+1 : une requête par membre
}
```

Premier problème : `find()` sans `where` retourne tout. Deuxième : charger `user` dans une boucle produit N+1 requêtes SQL. Troisième, hors champ de la requête : la colonne `joinedAt` n'existe pas encore en base — `synchronize: true` est désactivé en production.

TypeORM résout les trois :

```ts
// ✅ une seule requête, filtrée, triée, avec relation chargée en JOIN
const memberships = await memberRepo.find({
  where: { familyId },
  relations: { user: true },
  order: { role: 'ASC', joinedAt: 'ASC' },
})
```

Et pour `joinedAt`, une migration génère et applique le changement de schéma sans toucher aux données existantes. Ce module couvre l'API repository, le QueryBuilder, les transactions et le CLI de migrations.

## 2. Théorie complète, concise

### 2.1 Méthodes du repository

`Repository<Entity>` expose les opérations CRUD fondamentales. Les méthodes se divisent en deux familles : celles qui chargent l'entité en mémoire avant d'agir (`save`, `remove`) et celles qui émettent un SQL direct sans chargement (`update`, `delete`).

```ts
// --- LECTURE ---

// find — plusieurs résultats (tableau vide si aucun)
const members = await memberRepo.find({ where: { familyId: 'fam-1' } })

// findOne — un résultat ou null
const member = await memberRepo.findOne({ where: { id: 'mbr-1' } })

// findOneBy — raccourci find + where seulement, sans autres options
const member = await memberRepo.findOneBy({ id: 'mbr-1' })

// findOneOrFail — lève EntityNotFoundError si absent (NestJS peut le transformer en 404)
const member = await memberRepo.findOneOrFail({ where: { id: 'mbr-1' } })

// count
const total = await memberRepo.count({ where: { familyId: 'fam-1' } })

// --- ÉCRITURE ---

// create — instancie en mémoire sans SQL ; save — INSERT si pas d'id, UPDATE sinon
const saved = await memberRepo.save(
  memberRepo.create({ familyId, userId, role: 'member' })
)
// save déclenche les hooks @BeforeInsert / @BeforeUpdate et les cascades

// update — UPDATE direct sans charger l'entité (plus rapide, mais aucun hook)
await memberRepo.update({ id: 'mbr-1' }, { role: 'admin' })
// result.affected = nombre de lignes modifiées

// --- SUPPRESSION ---

// remove — charge puis supprime (déclenche hooks et cascades)
const m = await memberRepo.findOneOrFail({ where: { id: 'mbr-1' } })
await memberRepo.remove(m)

// delete — suppression directe sans chargement
await memberRepo.delete({ id: 'mbr-1' })
```

### 2.2 Options de requête : where, relations, order

`find()` accepte un objet d'options structuré. Toutes les clés sont optionnelles et combinables.

```ts
import { ILike, In, MoreThan } from 'typeorm'

const results = await memberRepo.find({
  // Conditions de filtre — AND implicite entre les clés d'un même objet
  where: { familyId: 'fam-1', role: In(['admin', 'owner']) },

  // Relations à charger en JOIN — zéro requête supplémentaire
  relations: { user: true },

  // Tri — plusieurs colonnes, ordre chaîné
  order: { role: 'ASC', joinedAt: 'DESC' },

  // Pagination
  skip: 0,
  take: 20,

  // Sélectionner un sous-ensemble de colonnes (optimisation réseau)
  select: { id: true, role: true, user: { id: true, email: true } },
})
```

**OR entre conditions :** passer un tableau à `where` — chaque objet est un bloc AND, les blocs sont combinés avec OR.

```ts
// WHERE (familyId = 'fam-1' AND role = 'owner') OR (familyId = 'fam-1' AND role = 'admin')
const admins = await memberRepo.find({
  where: [
    { familyId: 'fam-1', role: 'owner' },
    { familyId: 'fam-1', role: 'admin' },
  ],
})
// Ne pas confondre avec In() : tableau dans where = OR entre blocs, pas IN sur une colonne
```

Opérateurs disponibles : `In`, `Not`, `Like`, `ILike`, `Between`, `MoreThan`, `LessThan`, `IsNull`, `Raw`.

### 2.3 QueryBuilder

Pour les requêtes que `find()` ne peut pas exprimer — `GROUP BY`, `HAVING`, sous-requêtes, fonctions SQL, agrégats.

```ts
// Créer depuis le repository — 'mbr' est l'alias de la table dans la requête
const qb = memberRepo.createQueryBuilder('mbr')
```

**SELECT avec jointure et pagination**

```ts
const members = await memberRepo
  .createQueryBuilder('mbr')
  .leftJoinAndSelect('mbr.user', 'user')        // LEFT JOIN users + SELECT user.*
  .where('mbr.familyId = :familyId', { familyId })
  .andWhere('mbr.role IN (:...roles)', { roles: ['owner', 'admin'] })
  .orderBy('mbr.role', 'ASC')
  .addOrderBy('user.lastName', 'ASC')
  .skip(offset)
  .take(limit)
  .getMany()                                     // → FamilyMember[] avec user chargé
```

**Résultat unique**

```ts
const owner = await memberRepo
  .createQueryBuilder('mbr')
  .leftJoinAndSelect('mbr.user', 'user')
  .where('mbr.familyId = :familyId AND mbr.role = :role', { familyId, role: 'owner' })
  .getOne()                                      // → FamilyMember | null
```

**Agrégats — getRawMany**

```ts
const stats = await memberRepo
  .createQueryBuilder('mbr')
  .select('mbr.familyId', 'familyId')
  .addSelect('COUNT(mbr.id)', 'memberCount')
  .groupBy('mbr.familyId')
  .having('COUNT(mbr.id) >= :min', { min: 2 })
  .getRawMany()                                  // → { familyId: string; memberCount: string }[]
```

| Méthode | Retourne | Mapping entité | Cas d'usage |
|---------|----------|---------------|-------------|
| `getMany()` | `Entity[]` | Oui | Requêtes standard avec relations |
| `getOne()` | `Entity \| null` | Oui | Un seul résultat |
| `getManyAndCount()` | `[Entity[], number]` | Oui | Pagination avec total |
| `getRawMany()` | `any[]` | Non | GROUP BY, agrégats, fonctions SQL |
| `getCount()` | `number` | Non | Comptage sans chargement |

### 2.4 Chargement des relations

Trois stratégies, dans l'ordre de préférence :

**1. `relations` dans `find()` — le plus simple**

```ts
// TypeORM génère un seul LEFT JOIN — pas de N+1
const member = await memberRepo.findOne({
  where: { id },
  relations: { user: true, family: true },
})
```

**2. `leftJoinAndSelect` dans QueryBuilder — requêtes complexes**

```ts
const member = await memberRepo
  .createQueryBuilder('mbr')
  .leftJoinAndSelect('mbr.user', 'u')
  .leftJoinAndSelect('mbr.family', 'f')
  .where('mbr.id = :id', { id })
  .getOne()
```

**3. Relation `eager` — chargée à chaque `find()` automatiquement**

```ts
// Dans l'entité — à utiliser avec prudence (charge toujours, même si inutile)
@ManyToOne(() => User, { eager: true })
user: User
// Désactiver ponctuellement pour ce find précis :
await memberRepo.find({ loadEagerRelations: false })
```

À éviter absolument : charger des relations dans une boucle `for`. Chaque `findOne` dans la boucle = une requête SQL. Sur 50 membres, c'est 51 requêtes au lieu de 1.

### 2.5 Transactions

Une transaction garantit l'atomicité : soit toutes les opérations réussissent et sont commitées, soit aucune n'est appliquée (rollback).

**Approche 1 — `dataSource.manager.transaction` (recommandée pour la majorité des cas)**

```ts
await dataSource.manager.transaction(async (manager) => {
  // Toutes les opérations du callback partagent la même connexion transactionnelle
  const member = manager.create(FamilyMember, { familyId, userId, role: 'member' })
  await manager.save(member)

  // Si cette ligne lève une erreur, le save ci-dessus est rollbacké automatiquement
  await manager.increment(Family, { id: familyId }, 'memberCount', 1)
})
// COMMIT si le callback se termine sans erreur
// ROLLBACK automatique si une erreur est levée dans le callback
```

**Approche 2 — `QueryRunner` (contrôle fin : niveau d'isolation, savepoints)**

```ts
const queryRunner = dataSource.createQueryRunner()
await queryRunner.connect()
await queryRunner.startTransaction()           // démarre la transaction

try {
  await queryRunner.manager.save(FamilyMember, { familyId, userId, role: 'member' })
  await queryRunner.manager.increment(Family, { id: familyId }, 'memberCount', 1)
  await queryRunner.commitTransaction()        // COMMIT explicite
} catch (err) {
  await queryRunner.rollbackTransaction()      // ROLLBACK explicite
  throw err
} finally {
  await queryRunner.release()                  // toujours libérer — évite les fuites de connexion
}
```

| Critère | `manager.transaction` | `QueryRunner` |
|---------|----------------------|---------------|
| Verbosité | Faible | Élevée |
| Commit / Rollback | Automatique | Manuel |
| Niveau d'isolation | Non | `startTransaction('SERIALIZABLE')` |
| Savepoints | Non | Oui |

### 2.6 Migrations CLI

En production, `synchronize: true` est interdit — TypeORM peut émettre des `DROP COLUMN` sans contrôle. Les migrations versionnent les changements de schéma.

**Configuration `data-source.ts` (fichier dédié au CLI TypeORM)**

```ts
// data-source.ts — à la racine, exporté par défaut pour le CLI
import 'dotenv/config'
import { DataSource } from 'typeorm'

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['dist/**/*.entity.js'],       // entités compilées
  migrations: ['dist/migrations/*.js'],    // migrations compilées
})
```

**Scripts `package.json`**

```json
{
  "scripts": {
    "typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js",
    "migration:generate": "npm run typeorm -- migration:generate -d data-source.ts",
    "migration:run": "npm run typeorm -- migration:run -d data-source.ts",
    "migration:revert": "npm run typeorm -- migration:revert -d data-source.ts",
    "migration:show": "npm run typeorm -- migration:show -d data-source.ts"
  }
}
```

**Cycle de travail**

```bash
# 1. Modifier l'entité (ajouter un champ, changer une colonne)
# 2. Compiler
npm run build

# 3. Générer la migration — compare les entités compilées au schéma actuel
npm run migration:generate -- src/migrations/AddJoinedAtToMember

# 4. Vérifier le fichier généré (up / down) avant d'appliquer
# 5. Appliquer
npm run migration:run

# 6. Annuler si besoin
npm run migration:revert
```

**Structure d'une migration générée**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddJoinedAtToMember1720000000000 implements MigrationInterface {
  name = 'AddJoinedAtToMember1720000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "family_members" ADD "joinedAt" TIMESTAMP NOT NULL DEFAULT now()`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "family_members" DROP COLUMN "joinedAt"`
    )
  }
}
```

**Migration de seeding** — pour des données initiales qui ne dépendent pas d'une entité :

```ts
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    INSERT INTO "roles_config" ("key", "label") VALUES
      ('owner', 'Propriétaire'),
      ('admin', 'Administrateur'),
      ('member', 'Membre'),
      ('guest', 'Invité')
  `)
}

public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(
    `DELETE FROM "roles_config" WHERE "key" IN ('owner', 'admin', 'member', 'guest')`
  )
}
```

## 3. Worked examples

### Exemple A — FamilyMemberService : requêtes repository et QueryBuilder

```ts
// src/family/family-member.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, In } from 'typeorm'
import { FamilyMember } from './entities/family-member.entity'

@Injectable()
export class FamilyMemberService {
  constructor(
    @InjectRepository(FamilyMember)
    private readonly memberRepo: Repository<FamilyMember>,
    private readonly dataSource: DataSource,
  ) {}

  // find() + options : une seule requête SQL avec LEFT JOIN sur user
  async listMembers(familyId: string): Promise<FamilyMember[]> {
    return this.memberRepo.find({
      where: { familyId },
      relations: { user: true },          // JOIN user en une passe — pas de N+1
      order: { role: 'ASC', joinedAt: 'ASC' },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        user: { id: true, firstName: true, email: true },
      },
    })
  }

  // QueryBuilder : recherche + pagination — getManyAndCount retourne [données, total]
  async searchMembers(
    familyId: string,
    search: string,
    page: number,
    limit: number,
  ): Promise<[FamilyMember[], number]> {
    return this.memberRepo
      .createQueryBuilder('mbr')
      .leftJoinAndSelect('mbr.user', 'user')
      .where('mbr.familyId = :familyId', { familyId })
      // ILIKE = insensible à la casse (PostgreSQL) — impossible avec les options find()
      .andWhere('user.firstName ILIKE :search OR user.email ILIKE :search', {
        search: `%${search}%`,
      })
      .orderBy('mbr.joinedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()
    // SQL produit (une requête) :
    // SELECT mbr.*, user.* FROM family_members mbr
    // LEFT JOIN users user ON user.id = mbr.userId
    // WHERE mbr.familyId = $1 AND (user.firstName ILIKE $2 OR user.email ILIKE $2)
    // ORDER BY mbr.joinedAt DESC LIMIT $3 OFFSET $4
  }

  // getRawMany : statistiques par famille — GROUP BY impossible avec find()
  async familyStats(): Promise<{ familyId: string; memberCount: string }[]> {
    return this.memberRepo
      .createQueryBuilder('mbr')
      .select('mbr.familyId', 'familyId')
      .addSelect('COUNT(mbr.id)', 'memberCount')
      .groupBy('mbr.familyId')
      .having('COUNT(mbr.id) >= :min', { min: 1 })
      .orderBy('memberCount', 'DESC')
      .getRawMany()
    // getRawMany : objets bruts, pas d'instances d'entité
    // memberCount est une string (retour natif PostgreSQL pour COUNT)
  }
}
```

**Pas-à-pas :**
(1) `listMembers` utilise `find()` avec `relations: { user: true }` — TypeORM génère un LEFT JOIN, zéro requête N+1 ;
(2) `order` sur deux colonnes — `role` d'abord, `joinedAt` ensuite — impossible à exprimer autrement ;
(3) `select` réduit la bande passante — seules les colonnes listées sont chargées, y compris dans la relation ;
(4) `searchMembers` utilise `getManyAndCount()` qui retourne `[données, total]` en une seule requête — pattern standard pour la pagination ;
(5) `getRawMany()` dans `familyStats` retourne des objets bruts sans mapping d'entité — le seul choix pour GROUP BY et COUNT.

### Exemple B — Transaction : ajouter un membre de façon atomique

```ts
// src/family/family-member.service.ts (suite)
import { ConflictException } from '@nestjs/common'
import { Family } from './entities/family.entity'

async addMember(familyId: string, userId: string): Promise<FamilyMember> {
  // manager.transaction : commit/rollback automatiques — pas de try/catch pour le rollback
  return this.dataSource.manager.transaction(async (manager) => {
    // Étape 1 — vérifier que la famille existe et n'est pas pleine
    // lock pessimistic_write : empêche deux requêtes concurrentes de lire le même memberCount
    const family = await manager.findOne(Family, {
      where: { id: familyId },
      lock: { mode: 'pessimistic_write' },
    })
    if (!family) throw new NotFoundException(`Famille ${familyId} introuvable`)
    if (family.memberCount >= family.maxSize) {
      throw new ConflictException(`Famille ${familyId} complète`)
    }

    // Étape 2 — vérifier l'absence de doublon
    const existing = await manager.findOne(FamilyMember, {
      where: { familyId, userId },
    })
    if (existing) throw new ConflictException(`Utilisateur déjà membre`)

    // Étape 3 — créer l'adhésion
    // Toutes les opérations utilisent manager, pas this.memberRepo
    // → elles partagent la même connexion transactionnelle
    const member = manager.create(FamilyMember, {
      familyId,
      userId,
      role: 'member',
      joinedAt: new Date(),
    })
    const saved = await manager.save(member)

    // Étape 4 — incrémenter le compteur atomiquement (pas de race condition)
    await manager.increment(Family, { id: familyId }, 'memberCount', 1)

    return saved
    // Si une erreur est levée ci-dessus → ROLLBACK automatique
    // Si pas d'erreur → COMMIT automatique à la sortie du callback
  })
}
```

**Pas-à-pas :**
(1) `dataSource.manager.transaction(async (manager) => {...})` — NestJS injecte `DataSource` directement dans le service via le constructeur ;
(2) `lock: { mode: 'pessimistic_write' }` sur la famille — sans ce verrou, deux requêtes simultanées liraient le même `memberCount` et dépasseraient `maxSize` ;
(3) toutes les opérations utilisent `manager` (pas `this.memberRepo`) — c'est la règle absolue : utiliser un repository injecté dans une transaction ne partage pas la connexion ;
(4) `manager.increment` émet `UPDATE families SET memberCount = memberCount + 1` — atomique, sans charger l'entité ;
(5) si `ConflictException` ou `NotFoundException` est levé, TypeORM fait ROLLBACK — aucun `FamilyMember` n'est créé, aucun compteur n'est incrémenté.

## 4. Pièges & misconceptions

- **N+1 avec une boucle de `findOne`.** Charger des relations dans un `for` émet une requête SQL par itération. Sur 50 membres, c'est 51 requêtes au lieu de 1. *Correct* : `relations: { user: true }` dans `find()` ou `leftJoinAndSelect` dans le QueryBuilder.

- **`synchronize: true` en production.** TypeORM compare les entités au schéma et émet des `ALTER TABLE` ou `DROP COLUMN` sans avertissement. Renommer `firstName` en `givenName` dans l'entité → TypeORM supprime l'ancienne colonne et crée la nouvelle, détruisant toutes les données. *Correct* : `synchronize: false` en production, migrations CLI uniquement.

- **Oublier `queryRunner.release()`.** Sans `release()` dans `finally`, la connexion reste ouverte dans le pool. Sous charge, le pool est épuisé et toutes les requêtes bloquent. *Correct* : `finally { await queryRunner.release() }` systématiquement, même si le commit ou rollback a échoué.

- **Utiliser `this.repo` à l'intérieur d'une transaction.** Les repositories `@InjectRepository` utilisent une connexion distincte — ils ne participent pas à la transaction en cours. *Correct* : toutes les opérations d'une transaction doivent passer par le `manager` fourni en paramètre du callback.

- **Confondre `getMany()` et `getRawMany()`.** `getMany()` retourne des instances d'entité avec le mapping TypeORM. `getRawMany()` retourne des objets bruts — les colonnes sont préfixées automatiquement (`mbr_familyId`, `user_email`). Pour contrôler les noms, utiliser `.select('mbr.familyId', 'familyId')` avec un alias explicite.

- **Tableau dans `where` vs opérateur `In()`.** `find({ where: [{ role: 'owner' }, { role: 'admin' }] })` génère `WHERE role = 'owner' OR role = 'admin'` — deux conditions OR. `find({ where: { role: In(['owner', 'admin']) } })` génère `WHERE role IN ('owner', 'admin')` — une seule condition sur un seul champ. Utiliser `In()` pour une liste de valeurs d'un même champ.

## 5. Ancrage TribuZen

Couche fil-rouge : **requêtes et migrations de la base TribuZen (lister les membres d'une famille, migration du schéma)** (`smaurier/tribuzen`).

- `FamilyMemberService.listMembers(familyId)` — la route `GET /families/:id/members` retourne les membres triés par rôle avec leur `User` chargé en un seul JOIN. Pagination via `getManyAndCount()` — le total permet au frontend d'afficher le nombre de pages.
- `FamilyMemberService.addMember(familyId, userId)` — transaction qui vérifie la capacité (`maxSize`), crée `FamilyMember` et incrémente `family.memberCount` de façon atomique. Le verrou `pessimistic_write` prévient la race condition quand deux invitations sont acceptées simultanément.
- `familyStats()` via `getRawMany()` — tableau de bord admin : nombre de membres par famille, trié par popularité.
- Migration `AddJoinedAtToMember` — ajout de la colonne `joinedAt TIMESTAMP DEFAULT now()` sans toucher aux lignes existantes (la valeur par défaut les remplit automatiquement, les données historiques sont préservées).
- Migration de seeding `SeedRolesConfig` — insère les libellés de rôles au déploiement initial, indépendamment des entités TypeORM.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  family/
    entities/
      family.entity.ts             ← Family @Entity() avec memberCount + maxSize
      family-member.entity.ts      ← FamilyMember avec joinedAt (ajouté par migration)
    family-member.service.ts       ← listMembers, searchMembers, addMember (transaction)
    family.module.ts               ← TypeOrmModule.forFeature([Family, FamilyMember])
  migrations/
    1720000000000-AddJoinedAtToMember.ts
    1720000000001-SeedRolesConfig.ts
data-source.ts                     ← DataSource pour le CLI TypeORM
```

## 6. Points clés

1. `find()` avec `where`, `relations`, `order`, `skip`/`take` couvre 80 % des requêtes — préférer au QueryBuilder pour la lisibilité.
2. `relations: { user: true }` dans `find()` charge la relation en un seul JOIN — toujours préférer à une boucle `findOne` (N+1).
3. `createQueryBuilder('alias')` → `leftJoinAndSelect` → `where`/`andWhere` → `getMany()` / `getOne()` / `getRawMany()` / `getManyAndCount()`.
4. `getMany()` retourne des instances d'entité mappées ; `getRawMany()` retourne des objets bruts — utiliser pour les agrégats GROUP BY.
5. `dataSource.manager.transaction(async (manager) => {...})` — commit/rollback automatiques ; toutes les opérations doivent utiliser `manager`, jamais les repositories injectés.
6. `QueryRunner` pour le contrôle fin (niveau d'isolation, savepoints) — `release()` dans `finally` est obligatoire.
7. `synchronize: false` en production + CLI TypeORM pour toutes les évolutions de schéma.
8. `migration:generate` compare entités compilées au schéma actuel et génère `up`/`down` ; `migration:run` applique, `migration:revert` annule la dernière.

## 7. Seeds Anki

```
Pourquoi find avec relations est-il préférable à findOne dans une boucle ?|Il charge la relation en un seul LEFT JOIN — la boucle génère N+1 requêtes SQL (une par itération au lieu d'une seule au total)
Différence getMany vs getRawMany dans QueryBuilder ?|getMany retourne des instances d'entité avec mapping TypeORM ; getRawMany retourne des objets bruts sans mapping — seul getRawMany supporte GROUP BY et agrégats
Quand utiliser manager.transaction vs QueryRunner ?|manager.transaction pour la majorité des cas (commit/rollback automatiques) ; QueryRunner quand on a besoin d'un niveau d'isolation explicite ou de savepoints manuels
Pourquoi toutes les opérations d'une transaction doivent-elles utiliser manager ?|Les repositories @InjectRepository utilisent une connexion distincte du pool — ils ne participent pas à la transaction ; seul manager partage la connexion transactionnelle
Pourquoi queryRunner.release() doit-il toujours être dans finally ?|Sans release(), la connexion reste ouverte dans le pool — sous charge, le pool s'épuise et toutes les requêtes suivantes bloquent
Pourquoi synchronize true est-il interdit en production ?|TypeORM peut émettre DROP COLUMN ou ALTER TABLE sans avertissement, détruisant les données lors d'un renommage de propriété dans l'entité
Tableau dans where vs opérateur In — quelle différence ?|where tableau génère des blocs OR entre conditions entières ; In() génère IN sur un seul champ — utiliser In() pour filtrer plusieurs valeurs d'une même colonne
Quel fichier le CLI TypeORM utilise-t-il pour migration generate ?|Le DataSource exporté par défaut depuis data-source.ts passé avec -d — il compare les entités compilées dans dist au schéma réel de la base
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-15-typeorm-queries/README.md`. Tu y implémentes `listMembers` avec `find()`, `searchMembers` avec QueryBuilder et `getManyAndCount`, `addMember` en transaction, et tu génères + appliques une migration `AddJoinedAt` — corrigé complet commenté + variante J+30 dans le README.
