---
titre: GraphQL avec NestJS
cours: 09-nestjs
notions: [GraphQL vs REST, approche code-first NestJS, resolvers et décorateurs Resolver Query Mutation, types ObjectType et Field, arguments et input types, résolution de champs et ResolveField, problème N plus 1 et DataLoader, subscriptions en survol]
outcomes: [exposer une API GraphQL code-first avec NestJS, écrire des resolvers query et mutation, typer schéma et inputs, éviter le N+1 avec DataLoader]
prerequis: [25-mongodb-mongoose]
next: fin-parcours-09-nestjs
libs: [{ name: "@nestjs/graphql", version: "^13" }, { name: graphql, version: "^16" }, { name: "graphql-subscriptions", version: "^3" }]
tribuzen: exposer une API GraphQL de TribuZen (query familles avec membres, mutation d'invitation)
last-reviewed: 2026-07
---

# GraphQL avec NestJS

> **Outcomes — tu sauras FAIRE :** exposer une API GraphQL code-first avec NestJS, écrire des resolvers `@Query` et `@Mutation`, typer ton schéma avec `@ObjectType` et `@InputType`, résoudre des champs liés avec `@ResolveField`, et éliminer le problème N+1 avec DataLoader.
> **Difficulté :** :star::star::star::star:

## 1. Cas concret d'abord

TribuZen doit exposer ses données à deux clients très différents. L'app mobile n'a besoin que du nom de la famille et du nombre de membres sur l'écran d'accueil. L'app web charge la famille avec la liste complète des membres, leurs rôles et leurs activités récentes pour la page de gestion.

Tu essaies de construire ça en REST et tu bloques immédiatement :

```
GET /families        → retourne 12 champs par famille, le mobile n'en utilise que 2 (over-fetching)
GET /families/:id    → retourne la famille mais PAS les membres
GET /families/:id/members → requête séparée obligatoire (under-fetching)
```

Deux clients, trois endpoints, et le mobile sur-charge le réseau à chaque affichage. Avec GraphQL, chaque client déclare exactement ce qu'il veut en une seule requête :

```graphql
# Mobile — uniquement ce qu'il faut
query {
  families {
    id
    name
    memberCount
  }
}

# Web — famille + membres en une requête
query {
  family(id: "fam-1") {
    name
    members {
      id
      displayName
    }
  }
}
```

Ce module implémente cette API GraphQL code-first avec NestJS : `@ObjectType`, `@Resolver`, `@Query`, `@Mutation`, `@ResolveField`, `@InputType`, et un DataLoader pour éliminer le problème N+1 sur les membres.

## 2. Théorie complète, concise

### 2.1 GraphQL vs REST — ce qui change vraiment

REST = un endpoint par ressource, réponse fixe définie par le serveur. GraphQL = un seul endpoint `/graphql`, réponse définie par le client dans sa requête.

| Critère | REST | GraphQL |
|---|---|---|
| Endpoints | Un par ressource | Un seul (`/graphql`) |
| Champs retournés | Fixés par le serveur | Sélectionnés par le client |
| Relations | Plusieurs requêtes ou endpoints composites | Une requête hiérarchique |
| Contrat | Documentation + conventions | Schéma auto-documenté introspectable |
| Caching HTTP | Natif sur les GET | Complexe (tout passe en POST) |

**GraphQL l'emporte** quand plusieurs clients ont des besoins différents (mobile vs web), quand les données sont fortement interconnectées (familles → membres → activités), et quand le frontend évolue vite. REST reste préférable pour les APIs publiques simples, l'upload de fichiers, ou quand le caching HTTP est critique.

### 2.2 Approche code-first NestJS

NestJS propose deux approches : **code-first** (les décorateurs TypeScript génèrent le schéma SDL) et schema-first (le fichier `.graphql` est la source). Ce module utilise code-first — plus intégré avec l'écosystème NestJS, pas de double fichier à synchroniser.

Installation :

```bash
pnpm add @nestjs/graphql @nestjs/apollo @apollo/server graphql
```

Configuration dans `AppModule` :

```ts
import { Module } from '@nestjs/common'
import { GraphQLModule } from '@nestjs/graphql'
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo'
import { join } from 'path'

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // autoSchemaFile : NestJS génère src/schema.gql depuis les décorateurs TypeScript
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      // Playground désactivé en production — expose le schéma complet
      playground: process.env.NODE_ENV !== 'production',
    }),
  ],
})
export class AppModule {}
```

La propriété `autoSchemaFile` est le cœur du code-first : NestJS parcourt tous les `@ObjectType`, `@Resolver`, `@Query` et `@Mutation` au démarrage, construit le schéma SDL, et l'écrit dans le fichier. Le schéma est le résultat du code TypeScript, pas la source.

### 2.3 ObjectType et Field

`@ObjectType()` déclare une classe TypeScript comme type de sortie GraphQL. `@Field()` marque chaque champ exposé dans le schéma — un champ sans `@Field()` est invisible pour le client.

```ts
// src/family/models/member.model.ts
import { ObjectType, Field, ID } from '@nestjs/graphql'

@ObjectType()
export class Member {
  @Field(() => ID)
  id: string

  @Field()
  displayName: string

  @Field(() => ID)
  familyId: string
}
```

```ts
// src/family/models/family.model.ts
import { ObjectType, Field, ID, Int } from '@nestjs/graphql'
import { Member } from './member.model'

@ObjectType({ description: 'Une famille TribuZen' })
export class Family {
  @Field(() => ID)
  id: string

  @Field({ description: 'Nom affiché de la famille' })
  name: string

  @Field({ nullable: true })
  description?: string

  // Int doit être explicite — @Field() seul infèrerait Float pour un number
  @Field(() => Int)
  memberCount: number

  // Ce champ sera résolu par @ResolveField — pas chargé par findAll() directement
  @Field(() => [Member])
  members: Member[]
}
```

Règle fondamentale : TypeScript n'a qu'un type `number`. GraphQL distingue `Int` et `Float`. Il faut toujours passer le type scalaire explicitement en premier argument de `@Field(() => Int)` ou `@Field(() => Float)`. Sans ça, NestJS infère `Float` et le schéma génère `Float!` pour un entier.

### 2.4 Resolvers, Query, Mutation

`@Resolver(() => Family)` déclare la classe comme responsable de la résolution des champs du type `Family`. `@Query` expose une lecture, `@Mutation` expose une écriture.

```ts
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql'
import { Family } from './models/family.model'
import { FamilyService } from './family.service'
import { CreateFamilyInput } from './dto/create-family.input'
import { InviteMemberInput } from './dto/invite-member.input'
import { Member } from './models/member.model'

@Resolver(() => Family)
export class FamilyResolver {
  constructor(private readonly familyService: FamilyService) {}

  // name: 'families' = nom du champ dans le schéma (sans ça, NestJS utilise 'findAll')
  @Query(() => [Family], { name: 'families', description: 'Liste toutes les familles' })
  findAll(): Promise<Family[]> {
    return this.familyService.findAll()
  }

  // nullable: true = le champ peut retourner null dans le schéma (Family au lieu de Family!)
  @Query(() => Family, { name: 'family', nullable: true })
  findOne(@Args('id', { type: () => ID }) id: string): Promise<Family | null> {
    return this.familyService.findOne(id)
  }

  @Mutation(() => Family)
  createFamily(@Args('input') input: CreateFamilyInput): Promise<Family> {
    return this.familyService.create(input)
  }

  @Mutation(() => Member, { description: 'Invite un utilisateur dans une famille' })
  inviteMember(@Args('input') input: InviteMemberInput): Promise<Member> {
    return this.familyService.inviteMember(input)
  }
}
```

La propriété `name` dans `@Query({ name: 'families' })` définit le nom du champ dans le schéma GraphQL. Sans elle, NestJS utilise le nom de la méthode TypeScript (`findAll`) — qui expose un détail d'implémentation aux clients.

### 2.5 Arguments et InputType

`@Args('nom')` extrait un argument scalaire de la requête GraphQL. Pour des arguments complexes (mutations), on utilise `@InputType()` — l'équivalent GraphQL du DTO REST.

```ts
// src/family/dto/create-family.input.ts
import { InputType, Field } from '@nestjs/graphql'
import { IsNotEmpty, IsOptional, MaxLength } from 'class-validator'

@InputType()
export class CreateFamilyInput {
  @Field({ description: 'Nom de la famille' })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MaxLength(80)
  name: string

  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(300)
  description?: string
}
```

```ts
// src/family/dto/invite-member.input.ts
import { InputType, Field, ID } from '@nestjs/graphql'
import { IsUUID } from 'class-validator'

@InputType()
export class InviteMemberInput {
  @Field(() => ID)
  @IsUUID('4')
  familyId: string

  @Field(() => ID)
  @IsUUID('4')
  userId: string
}
```

Les décorateurs `class-validator` fonctionnent sur les `@InputType` exactement comme sur les DTOs REST, à condition que `ValidationPipe` soit actif globalement dans `main.ts`. Si `name` est vide, NestJS retourne une erreur GraphQL avant d'appeler le resolver.

Pour les arguments scalaires simples, `@Args` inline suffit :

```ts
// Argument scalaire : pas besoin de @InputType
@Query(() => [Family])
familiesByCity(@Args('city', { type: () => String }) city: string) {
  return this.familyService.findByCity(city)
}
```

### 2.6 Résolution de champs et ResolveField

`@ResolveField` indique comment résoudre un champ d'un `@ObjectType` qui n'est pas directement dans l'objet retourné par la query principale. `@Parent()` donne accès à l'objet parent dans l'arbre de résolution.

```ts
import { ResolveField, Parent } from '@nestjs/graphql'
import { MemberService } from '../member/member.service'

@Resolver(() => Family)
export class FamilyResolver {
  constructor(
    private readonly familyService: FamilyService,
    private readonly memberService: MemberService,
  ) {}

  @Query(() => [Family])
  families(): Promise<Family[]> {
    // familyService.findAll() ne charge PAS les membres — juste l'entité Family
    return this.familyService.findAll()
  }

  // NestJS appelle cette méthode pour chaque Family si le client demande `members { ... }`
  @ResolveField(() => [Member])
  members(@Parent() family: Family): Promise<Member[]> {
    // family.id provient de l'objet Family retourné par la Query parente
    return this.memberService.findByFamilyId(family.id)
  }
}
```

Flux de résolution pour `query { families { name members { displayName } } }` :
```
families()                       → retourne [Family] (50 familles)
  members(parent: Family)        → appelé 50 fois, une par famille
```

Sans DataLoader : 50 appels à `memberService.findByFamilyId()` = 50 requêtes DB supplémentaires. C'est le problème N+1.

### 2.7 Problème N+1 et DataLoader

Le N+1 : 1 requête pour charger N familles + N requêtes pour les membres = N+1 allers en base. Sur 50 familles, 51 requêtes au lieu de 2.

**DataLoader** regroupe (batch) tous les appels émis pendant un même tick d'exécution JavaScript et les consolide en un seul appel.

```bash
pnpm add dataloader
```

```ts
// src/member/member.loader.ts
import DataLoader from 'dataloader'
import { Injectable, Scope } from '@nestjs/common'
import { MemberService } from './member.service'
import { Member } from '../family/models/member.model'

// Scope.REQUEST : un DataLoader distinct par requête GraphQL
// → cache et batch isolés par requête — pas de fuite de données entre utilisateurs
@Injectable({ scope: Scope.REQUEST })
export class MemberLoader {
  constructor(private readonly memberService: MemberService) {}

  // DataLoader<KeyType, ValueType> : clé = familyId, valeur = Member[]
  readonly byFamilyId = new DataLoader<string, Member[]>(
    async (familyIds: readonly string[]) => {
      // Une seule requête DB pour tous les familyId collectés pendant le tick
      const members = await this.memberService.findByFamilyIds([...familyIds])

      // Regrouper les membres par familyId pour le mapping
      const map = new Map<string, Member[]>()
      for (const m of members) {
        const list = map.get(m.familyId) ?? []
        list.push(m)
        map.set(m.familyId, list)
      }

      // Retourner dans le MÊME ordre que familyIds — DataLoader l'exige
      // Un ordre différent associerait silencieusement les mauvais membres aux mauvaises familles
      return familyIds.map(id => map.get(id) ?? [])
    },
  )
}
```

Dans le resolver, on remplace l'appel direct au service par le DataLoader :

```ts
@ResolveField(() => [Member])
members(@Parent() family: Family): Promise<Member[]> {
  // .load() met familyId en file d'attente — la batchFn sera appelée une seule fois
  // avec tous les familyId collectés pendant le tick
  return this.memberLoader.byFamilyId.load(family.id)
}
```

Avant DataLoader : 51 requêtes pour 50 familles. Après : 2 requêtes (une pour les familles, une `IN (id1, id2, ...)` pour tous les membres).

### 2.8 Subscriptions en survol

Les subscriptions GraphQL envoient des données temps réel via WebSocket. NestJS les supporte avec `graphql-ws`.

```ts
// AppModule — activer les subscriptions
GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: true,
  subscriptions: { 'graphql-ws': true }, // protocole moderne recommandé
})
```

```ts
import { Subscription } from '@nestjs/graphql'
import { PubSub } from 'graphql-subscriptions'

// PubSub en mémoire — uniquement pour développement (une seule instance)
// En prod multi-instance : graphql-redis-subscriptions
const pubSub = new PubSub()

@Resolver(() => Family)
export class FamilyResolver {
  @Mutation(() => Member)
  async inviteMember(@Args('input') input: InviteMemberInput): Promise<Member> {
    const member = await this.familyService.inviteMember(input)
    // Publier l'événement — tous les clients abonnés seront notifiés
    await pubSub.publish('memberInvited', { memberInvited: member })
    return member
  }

  @Subscription(() => Member, { description: 'Notifié quand un membre est invité' })
  memberInvited() {
    return pubSub.asyncIterableIterator('memberInvited')
  }
}
```

> **Note version** : `asyncIterableIterator()` est l'API de `graphql-subscriptions` **v3**. La v2 utilisait `asyncIterator()` (sans `Iterable`) — si tu migres depuis v2, renommer l'appel suffit.

Le client s'abonne avec `subscription { memberInvited { displayName } }` — il reçoit une notification WebSocket à chaque `inviteMember`. En production, `PubSub` in-memory doit être remplacé par `graphql-redis-subscriptions` pour que les notifications soient distribuées entre toutes les instances serveur.

## 3. Worked examples

### Exemple A — FamilyResolver complet avec Query, Mutation et DataLoader

```ts
// src/family/models/member.model.ts
import { ObjectType, Field, ID } from '@nestjs/graphql'

@ObjectType()
export class Member {
  @Field(() => ID)
  id: string

  @Field()
  displayName: string

  @Field(() => ID)
  familyId: string
}
```

```ts
// src/family/models/family.model.ts
import { ObjectType, Field, ID, Int } from '@nestjs/graphql'
import { Member } from './member.model'

@ObjectType({ description: 'Une famille TribuZen' })
export class Family {
  @Field(() => ID)
  id: string

  @Field()
  name: string

  @Field({ nullable: true })
  description?: string

  @Field(() => Int)
  memberCount: number

  // Résolu par @ResolveField — absent du store, calculé à la demande
  @Field(() => [Member])
  members: Member[]
}
```

```ts
// src/family/dto/create-family.input.ts
import { InputType, Field } from '@nestjs/graphql'
import { IsNotEmpty, IsOptional, MaxLength } from 'class-validator'

@InputType()
export class CreateFamilyInput {
  @Field()
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MaxLength(80)
  name: string

  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(300)
  description?: string
}
```

```ts
// src/family/dto/invite-member.input.ts
import { InputType, Field, ID } from '@nestjs/graphql'
import { IsUUID } from 'class-validator'

@InputType()
export class InviteMemberInput {
  @Field(() => ID)
  @IsUUID('4')
  familyId: string

  @Field(() => ID)
  @IsUUID('4')
  userId: string
}
```

```ts
// src/family/family.resolver.ts
import {
  Resolver, Query, Mutation, Args, ResolveField, Parent, ID,
} from '@nestjs/graphql'
import { NotFoundException } from '@nestjs/common'
import { Family } from './models/family.model'
import { Member } from './models/member.model'
import { FamilyService } from './family.service'
import { MemberLoader } from '../member/member.loader'
import { CreateFamilyInput } from './dto/create-family.input'
import { InviteMemberInput } from './dto/invite-member.input'

@Resolver(() => Family)
export class FamilyResolver {
  constructor(
    private readonly familyService: FamilyService,
    // MemberLoader est Scope.REQUEST — NestJS crée une instance par requête GraphQL
    private readonly memberLoader: MemberLoader,
  ) {}

  @Query(() => [Family], { name: 'families', description: 'Liste toutes les familles TribuZen' })
  findAll(): Promise<Family[]> {
    // familyService.findAll() retourne les Family sans les membres — membres chargés par ResolveField
    return this.familyService.findAll()
  }

  @Query(() => Family, { name: 'family', nullable: true })
  findOne(@Args('id', { type: () => ID }) id: string): Promise<Family | null> {
    return this.familyService.findOne(id)
  }

  @Mutation(() => Family)
  createFamily(@Args('input') input: CreateFamilyInput): Promise<Family> {
    // ValidationPipe valide CreateFamilyInput avant que cette méthode soit appelée
    return this.familyService.create(input)
  }

  @Mutation(() => Member, { description: 'Invite un utilisateur dans une famille' })
  async inviteMember(@Args('input') input: InviteMemberInput): Promise<Member> {
    const family = await this.familyService.findOne(input.familyId)
    // NestJS convertit NotFoundException en erreur GraphQL avec le bon code
    if (!family) throw new NotFoundException(`Famille ${input.familyId} introuvable`)
    return this.familyService.inviteMember(input)
  }

  // Résout le champ members pour chaque Family — appelé par NestJS si le client demande members { ... }
  @ResolveField(() => [Member], { description: 'Membres de la famille' })
  members(@Parent() family: Family): Promise<Member[]> {
    // DataLoader.load() met familyId en file d'attente — la batchFn consolidera tous les IDs
    return this.memberLoader.byFamilyId.load(family.id)
  }
}
```

```ts
// src/family/family.module.ts
import { Module } from '@nestjs/common'
import { FamilyResolver } from './family.resolver'
import { FamilyService } from './family.service'
import { MemberLoader } from '../member/member.loader'
import { MemberService } from '../member/member.service'

@Module({
  // Le resolver doit figurer dans providers — @Resolver() seul ne suffit pas
  providers: [FamilyResolver, FamilyService, MemberLoader, MemberService],
})
export class FamilyModule {}
```

**Pas-à-pas :**
1. `@ObjectType()` sur `Family` et `Member` — NestJS intègre ces types dans le schéma SDL généré automatiquement.
2. `@Resolver(() => Family)` — ce resolver gère tous les champs du type `Family`.
3. `@Query(() => [Family], { name: 'families' })` — expose `query { families { ... } }` avec un nom explicite dans le schéma.
4. `@Mutation(() => Member)` sur `inviteMember` — expose `mutation { inviteMember(input: {...}) { ... } }`.
5. `@ResolveField(() => [Member])` sur `members` — NestJS appelle cette méthode pour chaque `Family` si le client inclut `members { ... }` dans sa requête.
6. `this.memberLoader.byFamilyId.load(family.id)` — au lieu de 50 appels directs au service, DataLoader les regroupe en une seule requête batch.

### Exemple B — MemberLoader DataLoader (élimination du N+1)

```ts
// src/member/member.loader.ts
import DataLoader from 'dataloader'
import { Injectable, Scope } from '@nestjs/common'
import { MemberService } from './member.service'
import { Member } from '../family/models/member.model'

@Injectable({ scope: Scope.REQUEST })
export class MemberLoader {
  constructor(private readonly memberService: MemberService) {}

  readonly byFamilyId = new DataLoader<string, Member[]>(
    async (familyIds: readonly string[]) => {
      // Une seule requête DB pour tous les familyId collectés pendant le tick
      // memberService.findByFamilyIds génère : WHERE family_id IN ('fam-1', 'fam-2', ...)
      const members = await this.memberService.findByFamilyIds([...familyIds])

      const map = new Map<string, Member[]>()
      for (const member of members) {
        const existing = map.get(member.familyId) ?? []
        existing.push(member)
        map.set(member.familyId, existing)
      }

      // DataLoader exige le MÊME ordre que les clés entrantes
      // familyIds.map(...) garantit la correspondance key→value
      return familyIds.map(id => map.get(id) ?? [])
    },
  )
}
```

Requête illustrant le gain :

```graphql
query {
  families {
    id
    name
    members {
      displayName
    }
  }
}
```

Sans DataLoader (50 familles) : 51 requêtes DB. Avec DataLoader : 2 requêtes DB.

**Pas-à-pas :**
1. `Scope.REQUEST` — NestJS crée une nouvelle instance de `MemberLoader` pour chaque requête HTTP. Le cache et le batch sont isolés par requête — pas de fuite de données entre clients simultanés.
2. `new DataLoader<string, Member[]>(batchFn)` — le type générique indique la clé (`familyId: string`) et la valeur (`Member[]`).
3. `findByFamilyIds([...familyIds])` — une requête `WHERE family_id IN (...)`. Le `[...]` spread convertit le `readonly string[]` en `string[]` mutable attendu par le service.
4. La `Map` regroupe les membres par `familyId` en une passe.
5. `familyIds.map(id => map.get(id) ?? [])` — retour ordonné comme les clés entrantes. Sans cet ordre, DataLoader associerait silencieusement les mauvais membres aux mauvaises familles.

## 4. Pièges & misconceptions

- **`@Field()` absent sur un champ.** Un champ de `@ObjectType` sans `@Field()` est invisible dans le schéma — le client ne peut pas le demander et NestJS ne lève pas d'erreur. Correction : chaque champ à exposer doit avoir `@Field()` explicitement.

- **`Int` vs `Float` non précisé.** `@Field()` sur un `number` TypeScript infère `Float` par défaut. `memberCount: number` avec juste `@Field()` génère `Float!` dans le schéma — le client reçoit `3.0` au lieu de `3`. Correction : `@Field(() => Int)` pour tous les entiers.

- **DataLoader en scope singleton.** Un `MemberLoader` sans `Scope.REQUEST` est un singleton partagé entre toutes les requêtes simultanées. Le cache DataLoader du singleton renvoie les membres d'un utilisateur A à l'utilisateur B. Correction : `@Injectable({ scope: Scope.REQUEST })` est obligatoire sur tout DataLoader.

- **Ordre de retour de la batch function non respecté.** DataLoader exige que le tableau retourné soit dans le même ordre que les clés entrantes. Retourner les membres triés alphabétiquement par `familyId` au lieu de suivre l'ordre de `familyIds` produit des associations incorrectes silencieuses. Correction : toujours `keys.map(k => map.get(k) ?? [])`.

- **`PartialType` importé depuis `@nestjs/mapped-types` pour un `@InputType`.** `PartialType` existe dans deux packages. Sur un `@InputType`, il faut impérativement l'importer depuis `@nestjs/graphql` — sinon les décorateurs `@Field` sont perdus et le schéma généré est incomplet sans erreur au démarrage. Correction : `import { PartialType } from '@nestjs/graphql'` sur les InputTypes.

- **Resolver absent des `providers` du module.** `@Resolver()` seul ne suffit pas — le resolver doit figurer dans `providers: [FamilyResolver]` du module, exactement comme un service. Sans ça, NestJS ne le détecte pas et le schéma reste vide. Correction : ajouter le resolver dans `providers`.

- **Playground actif en production.** Le playground Apollo expose le schéma complet et permet l'introspection à n'importe qui. Correction : `playground: process.env.NODE_ENV !== 'production'` dans `GraphQLModule.forRoot()`, et ajouter `introspection: false` pour bloquer l'introspection même sans playground.

## 5. Ancrage TribuZen

Couche fil-rouge : **exposer une API GraphQL de TribuZen (query familles avec membres, mutation d'invitation)** (`smaurier/tribuzen`).

- `query families { id name memberCount }` permet à l'app mobile de charger uniquement les deux champs dont elle a besoin — zéro over-fetching, pas d'endpoint dédié à créer.
- `query family(id) { name members { displayName } }` charge la famille et ses membres en une seule requête GraphQL — remplace les trois appels REST de la page de gestion web.
- `mutation inviteMember(input: { familyId, userId })` remplace `POST /families/:id/invite` — le retour contient le `Member` créé avec les champs sélectionnés par le client.
- `MemberLoader` élimine le N+1 sur les membres : toutes les familles d'une page sont résolues en une seule requête `WHERE family_id IN (...)` — performances stables quelle que soit la profondeur de la query.
- `InviteMemberInput` partage ses contraintes `class-validator` avec les DTOs REST existants — la validation est unifiée, pas dupliquée.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  family/
    models/
      family.model.ts          ← @ObjectType Family avec @Field(() => Int) memberCount
      member.model.ts          ← @ObjectType Member
    dto/
      create-family.input.ts   ← @InputType avec class-validator
      invite-member.input.ts   ← @InputType InviteMemberInput
    family.resolver.ts         ← @Resolver avec @Query, @Mutation, @ResolveField
    family.service.ts          ← findAll, findOne, create, inviteMember
    family.module.ts           ← providers: [FamilyResolver, FamilyService, MemberLoader, ...]
  member/
    member.loader.ts           ← MemberLoader @Injectable({ scope: Scope.REQUEST })
    member.service.ts          ← findByFamilyIds pour le batch DataLoader
```

## 6. Points clés

1. Code-first NestJS = `@ObjectType` + `@Field()` génèrent le schéma SDL via `autoSchemaFile` — le schéma est le résultat du code, pas la source.
2. `@Field()` est obligatoire sur chaque champ à exposer ; `@Field(() => Int)` ou `@Field(() => Float)` obligatoire pour les `number` (défaut `Float` sinon).
3. `@Resolver(() => Type)` déclare le responsable du type ; le resolver doit figurer dans `providers: [...]` du module comme tout provider.
4. `@Query(() => ReturnType, { name: '...' })` pour les lectures ; `@Mutation(() => ReturnType)` pour les écritures — le `name` évite d'exposer les noms de méthodes TypeScript.
5. `@Args('nom')` pour un scalaire ; `@Args('input') input: MyInput` pour un `@InputType` complexe — `class-validator` fonctionne si `ValidationPipe` est actif.
6. `@ResolveField()` résout un champ après la query principale — s'exécute pour chaque objet retourné, ce qui crée le problème N+1 sans DataLoader.
7. DataLoader batche les `.load(key)` émis pendant un même tick en un seul appel ; il doit être `Scope.REQUEST` pour isoler le cache par requête.
8. La batch function doit retourner les résultats dans le même ordre que les clés entrantes — `keys.map(k => map.get(k) ?? [])` est le pattern canonique.

## 7. Seeds Anki

```
Quelle différence entre @ObjectType et @InputType en GraphQL NestJS ?|@ObjectType définit un type de sortie (retourné par Query ou Mutation) ; @InputType définit un type d'entrée (passé en argument) — les deux sont distincts dans le schéma GraphQL
Pourquoi faut-il @Field(() => Int) et non juste @Field() pour un entier ?|TypeScript n'a qu'un type number — sans précision NestJS infère Float par défaut ; @Field(() => Int) force le scalaire Int dans le schéma SDL généré
Que fait autoSchemaFile dans GraphQLModule.forRoot ?|NestJS parcourt tous les @ObjectType et @Resolver au démarrage et génère le fichier schema.gql — le schéma est le résultat du code TypeScript, pas la source
À quoi sert @ResolveField et quand est-il appelé ?|Il résout un champ d'un @ObjectType non retourné par la Query principale — NestJS l'appelle pour chaque objet parent si le client demande ce champ
Quel est le problème N+1 en GraphQL et comment DataLoader le résout-il ?|Sans DataLoader, @ResolveField fait 1 requête DB par objet parent (N requêtes pour N objets) ; DataLoader collecte tous les IDs pendant un tick et fait une seule requête batch
Pourquoi le DataLoader doit-il être en Scope.REQUEST et non singleton ?|Un DataLoader singleton partage son cache entre toutes les requêtes simultanées — risque de fuite de données entre utilisateurs ; Scope.REQUEST crée un DataLoader isolé par requête HTTP
Quelle contrainte impose DataLoader sur le retour de la batch function ?|Le tableau retourné doit être dans le même ordre que le tableau de clés entrantes — keys.map(k => map.get(k) ?? []) est le pattern canonique
Depuis quel package importer PartialType pour un @InputType GraphQL ?|Depuis @nestjs/graphql (pas @nestjs/mapped-types) — sinon les décorateurs @Field sont perdus et le schéma GraphQL généré est incomplet sans erreur au démarrage
Pourquoi le name dans @Query(() => [Family], { name: 'families' }) est-il recommandé ?|Sans name NestJS expose le nom de la méthode TypeScript (findAll) dans le schéma — name: 'families' contrôle explicitement l'API publique indépendamment du nom de méthode
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-26-graphql/README.md`. Tu y exposes l'API GraphQL TribuZen code-first — `FamilyResolver` avec query familles et mutation d'invitation, `MemberLoader` DataLoader — code de A à Z, corrigé complet commenté + variante J+30 dans le README.

---

> **Navigation**
> ← [Module 25 — NestJS MongoDB Mongoose](./25-mongodb-mongoose.md) | **Dernier module du parcours 09-nestjs**
