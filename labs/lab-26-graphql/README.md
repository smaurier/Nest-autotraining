# Lab 26 — GraphQL avec NestJS

> **Outcome :** à la fin, tu sais exposer une API GraphQL code-first avec NestJS — `FamilyResolver` avec `@Query` et `@Mutation`, `MemberLoader` DataLoader pour éliminer le N+1.
> **Vrai outil :** NestJS 11, `@nestjs/graphql ^13`, Apollo Server v4, DataLoader.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu construis le module GraphQL de TribuZen dans un projet NestJS 11 existant. Pas de gap-fill — tu écris tout de A à Z à partir d'un projet vierge (`nest new tribuzen-graphql`).

Objectif fonctionnel :

- `query { families { id name memberCount } }` → retourne la liste des familles
- `query { family(id: "fam-1") { name members { displayName } } }` → une famille avec ses membres
- `mutation { createFamily(input: { name: "Dupont" }) { id name } }` → crée une famille (retour 201-équivalent)
- `mutation { inviteMember(input: { familyId: "...", userId: "..." }) { id displayName } }` → invite un membre
- Les membres d'une query `families` sont résolus via `MemberLoader` DataLoader — une seule requête batch, pas de N+1

## Étapes (en friction)

1. Configurer `GraphQLModule.forRoot` dans `AppModule` avec `driver: ApolloDriver`, `autoSchemaFile: true`, `playground: true`. Vérifier que `http://localhost:3000/graphql` ouvre le playground Apollo au démarrage.

2. Créer `src/family/models/member.model.ts` (`@ObjectType Member`) et `src/family/models/family.model.ts` (`@ObjectType Family` avec `@Field(() => Int) memberCount` et `@Field(() => [Member]) members`). Observer le schéma généré dans le playground — onglet Docs.

3. Créer `src/family/dto/create-family.input.ts` (`@InputType CreateFamilyInput` avec `class-validator`) et `src/family/dto/invite-member.input.ts` (`@InputType InviteMemberInput` avec `@IsUUID('4')` sur les deux IDs). Activer `ValidationPipe` global dans `main.ts` et vérifier qu'une mutation avec `name: ""` retourne une erreur de validation.

4. Créer `src/family/family.service.ts` avec un store en mémoire, et `src/family/family.resolver.ts` : `@Resolver(() => Family)` avec `@Query(() => [Family], { name: 'families' })`, `@Query(() => Family, { nullable: true, name: 'family' })`, `@Mutation(() => Family) createFamily`, `@Mutation(() => Member) inviteMember`. Enregistrer `FamilyResolver` dans `providers` du module (oubli fréquent). Tester dans le playground.

5. Créer `src/member/member.service.ts` avec `findByFamilyIds(ids: string[]): Member[]` retournant des membres filtrés par `familyId`. Créer `src/member/member.loader.ts` : `@Injectable({ scope: Scope.REQUEST })`, `readonly byFamilyId = new DataLoader<string, Member[]>(batchFn)`. Ajouter `@ResolveField(() => [Member]) members(@Parent() family: Family)` dans `FamilyResolver` qui appelle `this.memberLoader.byFamilyId.load(family.id)`. Tester avec `query { families { name members { displayName } } }` et vérifier (logs service) qu'une seule requête batch est émise.

## Corrigé complet commenté

```ts
// src/app.module.ts
import { Module } from '@nestjs/common'
import { GraphQLModule } from '@nestjs/graphql'
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo'
import { join } from 'path'
import { FamilyModule } from './family/family.module'

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      // Désactiver en production : expose le schéma complet à n'importe qui
      playground: process.env.NODE_ENV !== 'production',
    }),
    FamilyModule,
  ],
})
export class AppModule {}
```

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  // ValidationPipe global — active class-validator sur tous les @InputType
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  await app.listen(3000)
}
bootstrap()
```

```ts
// src/family/models/member.model.ts
import { ObjectType, Field, ID } from '@nestjs/graphql'

@ObjectType()
export class Member {
  @Field(() => ID)
  id: string

  @Field()
  displayName: string

  // familyId est nécessaire dans l'entité pour que MemberLoader puisse grouper par famille
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

  // Int explicite — @Field() seul infèrerait Float pour un number TypeScript
  @Field(() => Int)
  memberCount: number

  // Ce champ est résolu par @ResolveField dans FamilyResolver
  // familyService.findAll() ne le remplit pas — il serait undefined sans ResolveField
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
  @IsUUID('4', { message: 'familyId doit être un UUID v4' })
  familyId: string

  @Field(() => ID)
  @IsUUID('4', { message: 'userId doit être un UUID v4' })
  userId: string
}
```

```ts
// src/family/family.service.ts
import { Injectable } from '@nestjs/common'
import { Family } from './models/family.model'
import { Member } from './models/member.model'
import { CreateFamilyInput } from './dto/create-family.input'
import { InviteMemberInput } from './dto/invite-member.input'
import { randomUUID } from 'crypto'

@Injectable()
export class FamilyService {
  // Store en mémoire — remplacé par Mongoose ou Prisma en production
  private families: Family[] = [
    { id: 'fam-1', name: 'Famille Martin', memberCount: 2, members: [] },
    { id: 'fam-2', name: 'Famille Dupont', memberCount: 3, members: [] },
  ]

  private members: Member[] = [
    { id: 'mbr-1', displayName: 'Alice Martin', familyId: 'fam-1' },
    { id: 'mbr-2', displayName: 'Bob Martin',   familyId: 'fam-1' },
    { id: 'mbr-3', displayName: 'Claire Dupont', familyId: 'fam-2' },
    { id: 'mbr-4', displayName: 'David Dupont',  familyId: 'fam-2' },
    { id: 'mbr-5', displayName: 'Eva Dupont',    familyId: 'fam-2' },
  ]

  async findAll(): Promise<Family[]> {
    return this.families
  }

  async findOne(id: string): Promise<Family | null> {
    return this.families.find(f => f.id === id) ?? null
  }

  async create(input: CreateFamilyInput): Promise<Family> {
    const family: Family = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      memberCount: 0,
      members: [],
    }
    this.families.push(family)
    return family
  }

  async inviteMember(input: InviteMemberInput): Promise<Member> {
    const member: Member = {
      id: randomUUID(),
      displayName: `Utilisateur ${input.userId.slice(0, 8)}`,
      familyId: input.familyId,
    }
    this.members.push(member)
    const family = this.families.find(f => f.id === input.familyId)
    if (family) family.memberCount++
    return member
  }

  // Méthode batch utilisée par MemberLoader — une seule requête pour plusieurs familyId
  async findMembersByFamilyIds(familyIds: string[]): Promise<Member[]> {
    console.log(`[MemberService] batch query IN (${familyIds.join(', ')})`)
    return this.members.filter(m => familyIds.includes(m.familyId))
  }
}
```

```ts
// src/member/member.loader.ts
import DataLoader from 'dataloader'
import { Injectable, Scope } from '@nestjs/common'
import { FamilyService } from '../family/family.service'
import { Member } from '../family/models/member.model'

// Scope.REQUEST obligatoire — isole le cache DataLoader par requête HTTP
// Sans ça, le cache serait partagé entre tous les utilisateurs : fuite de données garantie
@Injectable({ scope: Scope.REQUEST })
export class MemberLoader {
  constructor(private readonly familyService: FamilyService) {}

  readonly byFamilyId = new DataLoader<string, Member[]>(
    async (familyIds: readonly string[]) => {
      // Une seule requête pour tous les familyId collectés pendant le tick
      const members = await this.familyService.findMembersByFamilyIds([...familyIds])

      const map = new Map<string, Member[]>()
      for (const m of members) {
        const list = map.get(m.familyId) ?? []
        list.push(m)
        map.set(m.familyId, list)
      }

      // Retour dans le même ordre que les clés — exigence DataLoader
      return familyIds.map(id => map.get(id) ?? [])
    },
  )
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
    private readonly memberLoader: MemberLoader,
  ) {}

  @Query(() => [Family], { name: 'families', description: 'Liste toutes les familles TribuZen' })
  findAll(): Promise<Family[]> {
    return this.familyService.findAll()
  }

  @Query(() => Family, { name: 'family', nullable: true })
  findOne(@Args('id', { type: () => ID }) id: string): Promise<Family | null> {
    return this.familyService.findOne(id)
  }

  @Mutation(() => Family)
  createFamily(@Args('input') input: CreateFamilyInput): Promise<Family> {
    return this.familyService.create(input)
  }

  @Mutation(() => Member)
  async inviteMember(@Args('input') input: InviteMemberInput): Promise<Member> {
    const family = await this.familyService.findOne(input.familyId)
    if (!family) throw new NotFoundException(`Famille ${input.familyId} introuvable`)
    return this.familyService.inviteMember(input)
  }

  // Sans DataLoader : memberService.findByFamilyId() appelé N fois pour N familles
  // Avec DataLoader : tous les familyId sont collectés pendant le tick, une seule requête batch
  @ResolveField(() => [Member])
  members(@Parent() family: Family): Promise<Member[]> {
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

@Module({
  // FamilyResolver doit être dans providers — @Resolver() seul ne suffit pas
  providers: [FamilyResolver, FamilyService, MemberLoader],
})
export class FamilyModule {}
```

## Variante J+30 (fading)

Même exercice, sans consulter le corrigé. Contraintes supplémentaires :

1. Ajouter une `query { familiesByCity(city: String!) { ... } }` — argument scalaire inline avec `@Args`, pas d'`@InputType` intermédiaire. Filtrer le store en mémoire par une propriété `city` à ajouter sur `Family`.

2. Ajouter `mutation { updateFamily(id: ID!, input: UpdateFamilyInput!) { ... } }` avec un `UpdateFamilyInput` qui réutilise `PartialType(CreateFamilyInput)` importé depuis `@nestjs/graphql` (pas `@nestjs/mapped-types`).

3. Ajouter une subscription `memberInvited: Member` qui se déclenche lors de chaque `inviteMember`. Configurer `subscriptions: { 'graphql-ws': true }` dans `GraphQLModule.forRoot`. Tester dans le playground en ouvrant deux onglets : un pour la subscription, un pour la mutation.

4. Remplacer le store en mémoire par Mongoose (module 25) — `FamilyService.findAll()` retourne une Promise réelle, `findMembersByFamilyIds` utilise `MemberModel.find({ familyId: { $in: ids } })`.

Temps cible : 45 minutes sans le corrigé.

## Application TribuZen

Commit cible dans `smaurier/tribuzen` :

```
feat(graphql): FamilyResolver code-first + MemberLoader DataLoader
```

Fichiers à créer :

- `apps/api/src/family/models/family.model.ts`
- `apps/api/src/family/models/member.model.ts`
- `apps/api/src/family/dto/create-family.input.ts`
- `apps/api/src/family/dto/invite-member.input.ts`
- `apps/api/src/family/family.resolver.ts`
- `apps/api/src/family/family.service.ts`
- `apps/api/src/family/family.module.ts`
- `apps/api/src/member/member.loader.ts`

Critère de done :

- `query { families { name memberCount } }` répond avec la liste des familles
- `query { families { name members { displayName } } }` répond en 2 requêtes DB (pas 1+N) — vérifiable dans les logs `[MemberService] batch query IN (...)`
- `mutation { inviteMember(input: { familyId: "xxx", userId: "yyy" }) { id } }` avec un UUID invalide retourne une erreur de validation avant d'atteindre le resolver
