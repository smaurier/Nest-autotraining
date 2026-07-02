---
titre: NestJS pipes, guards, interceptors
cours: 09-nestjs
notions: [pipes de validation et transformation, ValidationPipe et pipes custom, guards et canActivate, AuthGuard et autorisation par rôles, interceptors transform et logging, exception filters, ordre d'exécution du cycle de requête]
outcomes: [transformer/valider une entrée avec un pipe, protéger une route avec un guard (auth et rôles), transformer une réponse avec un interceptor, situer pipes/guards/interceptors/filters dans le cycle de requête]
prerequis: [12-nestjs-modules]
next: 14-typeorm-entites-relations
libs: [{ name: "@nestjs/common", version: "^11" }]
tribuzen: AuthGuard + RolesGuard (admin/membre) + interceptor de transformation sur l'API TribuZen
last-reviewed: 2026-07
---

# NestJS pipes, guards, interceptors

> **Outcomes — tu sauras FAIRE :** transformer et valider une entrée avec un pipe, protéger une route avec un guard (auth + rôles), transformer une réponse avec un interceptor, situer chaque couche dans le cycle de requête NestJS 11.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

TribuZen expose `POST /families/:id/invite`. Cette route doit : (1) valider que le body contient un email valide et un rôle connu, (2) refuser les non-connectés et les utilisateurs sans rôle `admin` ou `owner`, (3) renvoyer toutes les réponses dans un enveloppe `{ success, data, timestamp }` uniforme. Sans outil dédié, tout s'entasse dans le handler :

```ts
// ❌ tentative naïve — validation + auth + mise en forme dans le handler
@Post(':id/invite')
invite(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
  // Validation manuelle — à dupliquer sur chaque route
  if (!body.email?.includes('@')) throw new BadRequestException('Email invalide')
  if (!['admin', 'owner', 'member'].includes(body.role))
    throw new BadRequestException('Rôle invalide')

  // Auth inline — impossible à réutiliser
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) throw new UnauthorizedException()
  const user = decodeToken(token)
  if (!['admin', 'owner'].includes(user.role)) throw new ForbiddenException()

  const result = this.familyService.invite(id, body)
  // Enveloppe répétée dans chaque handler de l'API
  return { success: true, data: result, timestamp: new Date().toISOString() }
}
```

NestJS isole chaque responsabilité dans une couche dédiée :

```ts
// ✅ avec pipes / guards / interceptors — handler pur, chaque couche à sa place
@Post(':id/invite')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'owner')
invite(@Param('id') id: string, @Body() dto: InviteDto) {
  // ValidationPipe global valide InviteDto avant d'arriver ici
  // AuthGuard a posé request.user, RolesGuard a vérifié le rôle
  return this.familyService.invite(id, dto)
  // TransformInterceptor global wrappe la réponse automatiquement
}
```

Ce module explique chaque couche, son interface, et l'ordre d'exécution exact issu de la documentation NestJS 11.

## 2. Théorie complète, concise

### 2.1 Ordre d'exécution du cycle de requête

La documentation officielle NestJS 11 décrit l'ordre suivant :

```
Requête entrante
  → Middleware (global puis module)
  → Guards (global → controller → route)
  → Interceptors pre-handler (global → controller → route)
  → Pipes (global → controller → route → paramètre)
  → Handler (méthode du controller)
  → Interceptors post-handler (route → controller → global)
  → Exception Filters si erreur (route → controller → global)
  → Réponse HTTP
```

Deux règles structurantes : **avant le handler**, tout s'exécute du global vers le local ; **après le handler**, les interceptors et filters dépilent du local vers le global. Les pipes s'exécutent dans l'ordre global → controller → route, puis au niveau des paramètres du dernier au premier.

| Couche | Interface | Méthode clé | Interrompt si... |
|--------|-----------|-------------|-----------------|
| Guard | `CanActivate` | `canActivate()` | retourne `false` ou lève une exception |
| Interceptor | `NestInterceptor` | `intercept()` | ne pas appeler `next.handle()` |
| Pipe | `PipeTransform` | `transform()` | lève une exception |
| Filter | `ExceptionFilter` | `catch()` | agit sur les erreurs — ne bloque pas |

### 2.2 Pipes — validation et transformation

Un pipe est une classe `@Injectable()` qui implémente `PipeTransform` :

```ts
export interface PipeTransform<T = any, R = any> {
  transform(value: T, metadata: ArgumentMetadata): R
}
```

`ArgumentMetadata` expose `type` (`'body' | 'query' | 'param' | 'custom'`), `metatype` (type TypeScript du paramètre) et `data` (nom du paramètre décoré).

#### Pipes intégrés

```ts
// ParseIntPipe — paramètre de route converti en number, 400 si invalide
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.familyService.findOne(id)
}

// DefaultValuePipe AVANT ParseIntPipe — fournit la valeur par défaut si undefined
@Get()
findAll(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
) {
  return this.familyService.findAll(page, limit)
}
```

Autres pipes intégrés : `ParseUUIDPipe` (UUID v4), `ParseBoolPipe` (`'true'/'false'` → boolean), `ParseArrayPipe` (query string → tableau typé).

#### ValidationPipe avec class-validator

`ValidationPipe` est le pipe le plus utilisé. Il valide les DTOs automatiquement via `class-validator` et `class-transformer` :

```ts
// main.ts — configuration globale recommandée (NestJS 11)
async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,             // supprime les propriétés non décorées du DTO
      forbidNonWhitelisted: true,  // 400 si propriété inconnue envoyée par le client
      transform: true,             // transforme le body en instance de la classe DTO
    }),
  )
  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
```

```ts
// dto/invite.dto.ts
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator'

export enum FamilyRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

export class InviteDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string

  @IsEnum(FamilyRole, { message: 'Rôle invalide — valeurs acceptées: owner, admin, member' })
  @IsNotEmpty()
  role: FamilyRole
}
```

#### Pipe custom

```ts
// pipes/parse-positive-int.pipe.ts
import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common'

@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed) || parsed <= 0) {
      throw new BadRequestException(
        `Le paramètre "${metadata.data}" doit être un entier positif, reçu: "${value}"`,
      )
    }
    return parsed
  }
}
```

### 2.3 Guards — authentification et autorisation

Un guard implémente `CanActivate` :

```ts
export interface CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean>
}
```

`ExecutionContext` étend `ArgumentsHost` et ajoute `getClass()` et `getHandler()`. Ces deux méthodes permettent à `Reflector` de lire les métadonnées décorateur (comme les rôles requis) définies au niveau du controller ou de la route.

**Niveaux d'application :**

```ts
// Niveau global via module — RECOMMANDÉ car supporte l'injection de dépendances
@Module({
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

// Niveau controller ou handler
@UseGuards(AuthGuard, RolesGuard)
@Controller('families')
export class FamilyController {}
```

L'ordre dans `@UseGuards()` est l'ordre d'exécution. Un guard qui échoue empêche tous les suivants de s'exécuter.

### 2.4 Interceptors — pré- et post-handler

Un interceptor implémente `NestInterceptor` :

```ts
export interface NestInterceptor<T = any, R = any> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<R>
}
```

`next.handle()` retourne un `Observable` représentant la réponse du handler. Tout ce qui précède `next.handle()` s'exécute avant le handler ; les opérateurs RxJS dans `.pipe(...)` s'exécutent après :

```ts
intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
  console.log('AVANT le handler')           // pré-handler
  return next.handle().pipe(
    tap(() => console.log('APRÈS le handler')), // post-handler
    map((data) => ({ wrapped: data })),         // transformation de la réponse
  )
}
```

Opérateurs RxJS utiles dans un interceptor : `map` (transformer la valeur), `tap` (effet de bord sans modification), `timeout` (limite de durée), `catchError` (fallback sur erreur upstream).

### 2.5 Exception Filters

Un filter implémente `ExceptionFilter` et est décoré par `@Catch(TypeException)` :

```ts
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()
    const request = ctx.getRequest()

    response.status(exception.getStatus()).json({
      success: false,
      statusCode: exception.getStatus(),
      message: exception.message,
      timestamp: new Date().toISOString(),
      path: request.url,
    })
  }
}
```

`@Catch()` sans argument capture toutes les exceptions. NestJS fournit une hiérarchie d'exceptions HTTP héritant toutes de `HttpException` : `BadRequestException` (400), `UnauthorizedException` (401), `ForbiddenException` (403), `NotFoundException` (404), `ConflictException` (409), `InternalServerErrorException` (500).

## 3. Worked examples

### Exemple A — AuthGuard + RolesGuard sur les routes TribuZen

```ts
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common'

export const ROLES_KEY = 'roles'
// @Roles(...) stocke les rôles requis dans les métadonnées de la route via SetMetadata
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)
```

```ts
// src/common/guards/auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const token = request.headers.authorization?.split(' ')[1]

    if (!token) {
      throw new UnauthorizedException('Token manquant')
    }

    // En production : jwtService.verifyAsync(token) — voir module 19
    // Simulation : token = "userId:role"
    const [id, role] = token.split(':')
    if (!id || !role) throw new UnauthorizedException('Token invalide')

    // request.user est lu par RolesGuard — AuthGuard DOIT s'exécuter avant
    request['user'] = { id, role }
    return true
  }
}
```

```ts
// src/common/guards/roles.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '../decorators/roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // getAllAndOverride cherche les métadonnées sur le handler d'abord, puis le controller
    // Le handler l'emporte — permet une exception de rôle par route
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!required || required.length === 0) return true // route accessible sans rôle spécifique

    const user = context.switchToHttp().getRequest()['user']
    if (!user) throw new ForbiddenException('Utilisateur non authentifié')

    if (!required.includes(user.role)) {
      throw new ForbiddenException(`Rôle requis : ${required.join(' ou ')}`)
    }

    return true
  }
}
```

```ts
// src/family/family.controller.ts (extrait — routes protégées)
import { Controller, Post, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../common/guards/auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { InviteDto } from './dto/invite.dto'
import { FamilyService } from './family.service'

@Controller('families')
@UseGuards(AuthGuard, RolesGuard) // AuthGuard TOUJOURS avant RolesGuard — l'ordre est l'exécution
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  @Post(':id/invite')
  @Roles('admin', 'owner')
  invite(@Param('id') id: string, @Body() dto: InviteDto) {
    // dto validé par ValidationPipe global, user posé par AuthGuard, rôle vérifié par RolesGuard
    return this.familyService.invite(id, dto)
  }

  @Delete(':id/members/:memberId')
  @Roles('owner') // seul l'owner peut expulser
  removeMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.familyService.removeMember(id, memberId)
  }
}
```

**Pas-à-pas :** (1) `@Roles('admin', 'owner')` stocke `['admin', 'owner']` dans les métadonnées de la route via `SetMetadata` ; (2) `AuthGuard.canActivate()` extrait le token, décode l'utilisateur et l'attache à `request.user` — sans ce préalable, `RolesGuard` lèverait toujours `ForbiddenException` car `request.user` serait `undefined` ; (3) `RolesGuard` lit les métadonnées avec `reflector.getAllAndOverride()` — handler prioritaire sur controller, permettant `@Roles('owner')` sur une route spécifique même si le controller a `@Roles('admin', 'owner')` ; (4) `ValidationPipe` global valide `InviteDto` — `@IsEmail` et `@IsEnum` rejettent le body avant que le handler soit atteint.

### Exemple B — TransformInterceptor + LoggingInterceptor globaux

```ts
// src/common/interceptors/transform.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface ApiResponse<T> {
  success: boolean
  data: T
  timestamp: string
  path: string
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest()
    return next.handle().pipe(
      // map s'exécute APRÈS le handler — transforme chaque réponse sans la toucher avant
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
        path: request.url,
      })),
    )
  }
}
```

```ts
// src/common/interceptors/logging.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest()
    const { method, url } = req
    const start = Date.now()

    this.logger.log(`→ ${method} ${url}`) // pré-handler — avant next.handle()

    return next.handle().pipe(
      // tap n'altère pas la valeur — effet de bord uniquement (log, metric, etc.)
      tap({
        next: () => this.logger.log(`← ${method} ${url} ${Date.now() - start}ms`),
        error: (err: Error) => this.logger.error(`✗ ${method} ${url} — ${err.message}`),
      }),
    )
  }
}
```

```ts
// src/app.module.ts — guards et interceptors globaux via APP_GUARD / APP_INTERCEPTOR
import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { AuthGuard } from './common/guards/auth.guard'
import { RolesGuard } from './common/guards/roles.guard'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'

@Module({
  providers: [
    // Guards globaux — l'ordre des providers APP_GUARD = ordre d'exécution
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Interceptors globaux — LoggingInterceptor enveloppe TransformInterceptor
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
```

**Pas-à-pas :** (1) `APP_GUARD` et `APP_INTERCEPTOR` sont des tokens fournis par `@nestjs/core` — ils permettent l'injection de dépendances (`Reflector`, `JwtService`) dans les guards/interceptors globaux, contrairement à `app.useGlobalGuards()` qui crée l'instance manuellement sans DI ; (2) `TransformInterceptor` utilise `map` — chaque réponse est transformée après le handler dans un enveloppe uniforme que le frontend consomme sans vérifier le format cas par cas ; (3) `LoggingInterceptor` utilise `tap` — effet de bord sans modification de la valeur ; (4) l'ordre des `APP_INTERCEPTOR` détermine l'ordre pré-handler — `LoggingInterceptor` se déclenche d'abord, ce qui permet de logguer le temps total incluant `TransformInterceptor`.

## 4. Pièges & misconceptions

- **Ordre des guards dans `@UseGuards()`.** `@UseGuards(RolesGuard, AuthGuard)` — `RolesGuard` tente de lire `request.user` qui n'existe pas encore et lève `ForbiddenException` systématiquement. Correction : toujours `[AuthGuard, RolesGuard]` — le guard qui pose le contexte (auth) doit précéder le guard qui le consomme (rôles).

- **`app.useGlobalGuards()` vs `APP_GUARD`.** `app.useGlobalGuards(new AuthGuard())` crée une instance manuellement — impossible d'injecter `JwtService` ou `Reflector`. En pratique `new AuthGuard()` plante au démarrage si `AuthGuard` attend des dépendances. Correction : `{ provide: APP_GUARD, useClass: AuthGuard }` dans un module pour que NestJS gère l'injection.

- **`whitelist: true` oublié sur `ValidationPipe`.** Sans cette option, un client peut envoyer `{ email: 'x@y.fr', role: 'member', isAdmin: true }` — `isAdmin` traverse le pipe et atteint le service. Correction : `whitelist: true` + `forbidNonWhitelisted: true` — le client reçoit 400 dès qu'il envoie une propriété inconnue du DTO.

- **`next.handle()` non appelé dans un interceptor.** Si `intercept()` retourne un Observable sans appeler `next.handle()`, le handler ne s'exécute jamais — la requête reste bloquée silencieusement sans erreur. Correction : toujours `return next.handle().pipe(...)` sauf court-circuit intentionnel (cache, mock en test).

- **`Reflector.get()` vs `Reflector.getAllAndOverride()`.** `get(key, [handler])` lit uniquement les métadonnées du handler — si `@Roles` est sur le controller et pas la route, `get()` retourne `undefined`. `getAllAndOverride(key, [handler, controller])` cherche handler d'abord puis controller, le premier résultat non-`undefined` gagne. Pour les rôles, `getAllAndOverride` est presque toujours le bon choix.

- **`@Catch()` sans argument masque les erreurs en dev.** Un filter `@Catch()` global qui retourne une réponse 500 générique intercepte aussi les erreurs de programmation (TypeError, ReferenceError) sans les logguer. Correction : `@Catch(HttpException)` pour les erreurs HTTP + `@Catch()` séparé pour les erreurs inattendues avec logging complet du stack trace côté serveur.

## 5. Ancrage TribuZen

Couche fil-rouge : **AuthGuard + RolesGuard (admin/membre) + interceptor de transformation sur l'API TribuZen** (`smaurier/tribuzen`).

- `AuthGuard` lit `Authorization: Bearer <token>` sur chaque requête protégée. Au module 19 (JWT), `decodeToken()` sera remplacé par `jwtService.verifyAsync(token)` — l'interface `CanActivate` reste identique, seule l'implémentation interne change.
- `RolesGuard` protège `POST /families/:id/invite` (`@Roles('owner', 'admin')`), `DELETE /families/:id/members/:memberId` (`@Roles('owner')`) et `GET /families/:id/settings` (`@Roles('owner', 'admin')`). Les `member` et `guest` ne peuvent ni inviter ni expulser.
- `TransformInterceptor` enveloppe toutes les réponses de l'API TribuZen dans `{ success: true, data, timestamp, path }`. Le frontend React Native consomme ce contrat uniforme — une seule logique de parsing côté client, pas de vérification de format par route.
- `LoggingInterceptor` log `→ POST /families/fam-1/invite` avant le handler et `← POST /families/fam-1/invite 12ms` après — observabilité opérationnelle sans modifier un seul handler ou service.
- `ParsePositiveIntPipe` sur les paramètres `page` et `limit` de `GET /families` garantit qu'un entier positif arrive dans `FamilyService.findAll()` — pas de `parseInt` éparpillé dans les services.
- `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` global protège toutes les routes TribuZen d'injection de propriétés non attendues dans les DTOs.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  common/
    decorators/
      roles.decorator.ts          ← ROLES_KEY + @Roles(...)
    guards/
      auth.guard.ts               ← AuthGuard — extrait et vérifie le token Bearer
      roles.guard.ts              ← RolesGuard — Reflector + @Roles → user.role
    interceptors/
      logging.interceptor.ts      ← log avant/après, tap sans altérer la valeur
      transform.interceptor.ts    ← map vers { success, data, timestamp, path }
    pipes/
      parse-positive-int.pipe.ts  ← BadRequestException si NaN ou <= 0
  family/
    dto/
      invite.dto.ts               ← @IsEmail + @IsEnum(FamilyRole)
    family.controller.ts          ← @UseGuards + @Roles sur les routes sensibles
  app.module.ts                   ← APP_GUARD (Auth + Roles) + APP_INTERCEPTOR (Log + Transform)
```

## 6. Points clés

1. Ordre de requête NestJS : Middleware → Guards → Interceptors pre-handler → Pipes → Handler → Interceptors post-handler → Exception Filters.
2. Avant le handler, tout s'exécute global → local ; après le handler (interceptors post, filters), l'ordre est local → global (dépilage).
3. `CanActivate.canActivate()` retourne `boolean | Promise<boolean>` — retourner `false` interrompt la requête avec `ForbiddenException` automatique.
4. `PipeTransform.transform()` retourne la valeur transformée ou lève une exception — NestJS renvoie immédiatement la réponse d'erreur sans appeler le handler.
5. `NestInterceptor.intercept()` reçoit `next: CallHandler` — toujours appeler `next.handle()` pour laisser passer la requête ; `.pipe(map(...))` transforme la réponse post-handler.
6. `@UseGuards(AuthGuard, RolesGuard)` : l'ordre est l'ordre d'exécution — `AuthGuard` doit poser `request.user` avant que `RolesGuard` le lise.
7. `APP_GUARD` / `APP_INTERCEPTOR` dans un module = global avec DI (injecter `Reflector`, `JwtService`) ; `app.useGlobalGuards()` dans `main.ts` = global sans DI.
8. `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` est la configuration minimale de sécurité pour toute API NestJS 11 en production.

## 7. Seeds Anki

```
Quel est l'ordre d'exécution des couches dans NestJS 11 ?|Middleware → Guards → Interceptors pre-handler → Pipes → Handler → Interceptors post-handler → Exception Filters
Pourquoi AuthGuard doit-il précéder RolesGuard dans @UseGuards() ?|AuthGuard pose request.user — sans lui RolesGuard ne peut pas lire le rôle et lève ForbiddenException systématiquement
Différence entre APP_GUARD et app.useGlobalGuards() ?|APP_GUARD dans un module supporte l'injection de dépendances (Reflector, JwtService) ; app.useGlobalGuards() crée l'instance manuellement sans DI
À quoi sert Reflector.getAllAndOverride() dans RolesGuard ?|Lit les métadonnées @Roles sur le handler d'abord puis le controller — le handler l'emporte, permettant une exception de rôle par route
Que fait ValidationPipe avec whitelist:true et forbidNonWhitelisted:true ?|whitelist supprime les propriétés non décorées du DTO ; forbidNonWhitelisted lève 400 si une propriété inconnue est envoyée — protège contre l'injection de champs non attendus
Comment un interceptor agit-il avant ET après le handler ?|La logique avant next.handle() s'exécute pré-handler ; les opérateurs RxJS dans .pipe() (map, tap) s'exécutent post-handler sur l'Observable retourné
Quelle est la différence de comportement entre map et tap dans un interceptor ?|map transforme la valeur retournée (réponse modifiée) ; tap exécute un effet de bord (log, metric) sans modifier la valeur
Pourquoi chaîner DefaultValuePipe avant ParseIntPipe ?|DefaultValuePipe fournit la valeur par défaut si le paramètre est undefined — ParseIntPipe reçoit ensuite une valeur non-undefined et peut la convertir sans lever BadRequestException
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-13-pipes-guards/README.md`. Tu y implémentes `ParsePositiveIntPipe`, `AuthGuard`, `RolesGuard`, `LoggingInterceptor`, `TransformInterceptor` et `HttpExceptionFilter` sur une API Items TribuZen — corrigé complet commenté + variante J+30 dans le README.

> **Pont →** L'API TribuZen est désormais validée, protégée et transformée — mais les données vivent toujours en mémoire. Le module 14 (TypeORM) y remédie en les persistant dans PostgreSQL.
