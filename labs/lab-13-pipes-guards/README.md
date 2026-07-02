# Lab 13 — NestJS pipes, guards, interceptors

> **Outcome :** à la fin, tu sais implémenter un pipe custom de validation, un guard d'authentification, un guard de rôles avec `Reflector`, un interceptor de logging et un interceptor de transformation — sur une API NestJS 11 réelle.
> **Vrai outil :** NestJS 11 (`@nestjs/common`, `@nestjs/core`, `class-validator`, `class-transformer`).
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu travailles sur l'API Items de TribuZen. Le projet NestJS existe déjà (`src/` en place, `package.json` configuré). Ta mission : implémenter les six couches transversales — sans modifier le controller ni le service existants.

Objectif fonctionnel :

| Méthode | Route | Protection | Pipe |
|---------|-------|-----------|------|
| `GET` | `/items` | aucune | — |
| `GET` | `/items/:id` | aucune | `ParsePositiveIntPipe` sur `:id` |
| `POST` | `/items` | `AuthGuard` | `ValidationPipe` global |
| `PATCH` | `/items/:id` | `AuthGuard` | `ParsePositiveIntPipe` + `ValidationPipe` |
| `DELETE` | `/items/:id` | `AuthGuard` + `@Roles('admin')` | `ParsePositiveIntPipe` |

Toutes les réponses sont enveloppées dans `{ data: ... }` par `TransformInterceptor`. Chaque requête est loggée (méthode + url + durée) par `LoggingInterceptor`. Les erreurs HTTP ont le format `{ success: false, statusCode, message, path }`.

## Étapes (en friction)

1. **`ParsePositiveIntPipe`.** Implémente `src/common/pipes/parse-positive-int.pipe.ts` — interface `PipeTransform<string, number>`. Lance `BadRequestException` si la valeur n'est pas un entier strictement positif. Inclure le nom du paramètre (`metadata.data`) dans le message d'erreur.

2. **`AuthGuard`.** Implémente `src/common/guards/auth.guard.ts` — interface `CanActivate`. Extrait le token du header `Authorization: Bearer <token>`. Lance `UnauthorizedException('Token manquant')` si absent. Simule la vérification : token = `"userId:role"` → `request['user'] = { id, role }`.

3. **`@Roles` + `RolesGuard`.** Implémente `src/common/decorators/roles.decorator.ts` (décorateur `@Roles(...roles)` via `SetMetadata`). Implémente `src/common/guards/roles.guard.ts` — utilise `Reflector.getAllAndOverride()` sur `[handler, controller]`. Lance `ForbiddenException` si le rôle de `request.user` n'est pas dans la liste requise.

4. **`LoggingInterceptor`.** Implémente `src/common/interceptors/logging.interceptor.ts` — interface `NestInterceptor`. Log `→ METHOD /url` avant le handler. Utilise `tap` pour logguer `← METHOD /url Nms` après. Utilise `Logger` de `@nestjs/common` avec le contexte `'HTTP'`.

5. **`TransformInterceptor`.** Implémente `src/common/interceptors/transform.interceptor.ts` — wrappe chaque réponse dans `{ data: <valeur_originale> }` via `map`. Signature générique `NestInterceptor<T, { data: T }>`.

6. **`HttpExceptionFilter`.** Implémente `src/common/filters/http-exception.filter.ts` — `@Catch(HttpException)`. Renvoie `{ success: false, statusCode, message, timestamp, path }`.

7. **Enregistrement global.** Dans `src/app.module.ts`, enregistre via `APP_GUARD`, `APP_INTERCEPTOR`, `APP_FILTER`. Ordre des guards : `AuthGuard` en premier, `RolesGuard` en second. Dans `src/main.ts`, ajoute `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. Lance `npm run start:dev` et vérifie :
   - `GET /items` → 200 `{ data: [...] }`
   - `GET /items/abc` → 400 (ParsePositiveIntPipe)
   - `POST /items` sans header → 401
   - `DELETE /items/1` avec header `Authorization: Bearer user1:member` → 403
   - `DELETE /items/1` avec header `Authorization: Bearer admin1:admin` → 200

## Corrigé complet commenté

```ts
// src/common/pipes/parse-positive-int.pipe.ts
import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common'

@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const parsed = parseInt(value, 10)
    // isNaN couvre les strings non numériques ; <= 0 couvre zéro et les négatifs
    if (isNaN(parsed) || parsed <= 0) {
      throw new BadRequestException(
        `Le paramètre "${metadata.data}" doit être un entier positif, reçu: "${value}"`,
      )
    }
    return parsed
  }
}
```

```ts
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common'

export const ROLES_KEY = 'roles'
// SetMetadata stocke les rôles dans les métadonnées de la route ou du controller
// Reflector les lira dans RolesGuard via getAllAndOverride
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)
```

```ts
// src/common/guards/auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Request } from 'express'

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const token = request.headers.authorization?.split(' ')[1]

    if (!token) {
      throw new UnauthorizedException('Token manquant')
    }

    // Simulation — module 19 remplacera par jwtService.verifyAsync(token)
    const [id, role] = token.split(':')
    if (!id || !role) throw new UnauthorizedException('Token invalide')

    // request.user DOIT être posé ici — RolesGuard en dépend
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
  // Reflector est fourni par @nestjs/core — injectable si le guard est dans un module
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // getAllAndOverride : handler prioritaire sur controller
    // Si @Roles sur la route ET sur le controller, la route l'emporte
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // Pas de @Roles = accessible à tout utilisateur authentifié
    if (!required || required.length === 0) return true

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

    // Pré-handler — s'exécute avant next.handle()
    this.logger.log(`→ ${method} ${url}`)

    return next.handle().pipe(
      // tap n'altère pas la valeur — effet de bord uniquement
      tap({
        next: () => this.logger.log(`← ${method} ${url} ${Date.now() - start}ms`),
        error: (err: Error) => this.logger.error(`✗ ${method} ${url} — ${err.message}`),
      }),
    )
  }
}
```

```ts
// src/common/interceptors/transform.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, { data: T }> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<{ data: T }> {
    // map s'exécute APRÈS le handler — chaque réponse est wrappée dans { data: ... }
    return next.handle().pipe(map((data) => ({ data })))
  }
}
```

```ts
// src/common/filters/http-exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import { Request, Response } from 'express'

@Catch(HttpException) // capture uniquement les exceptions HTTP — pas les erreurs JS brutes
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const status = exception.getStatus()

    response.status(status).json({
      success: false,
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
      path: request.url,
    })
  }
}
```

```ts
// src/app.module.ts
import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ItemsModule } from './items/items.module'
import { AuthGuard } from './common/guards/auth.guard'
import { RolesGuard } from './common/guards/roles.guard'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

@Module({
  imports: [ItemsModule],
  providers: [
    // Guards globaux — AuthGuard AVANT RolesGuard (pose request.user)
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Interceptors — LoggingInterceptor enveloppe TransformInterceptor
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    // Filter global — HttpException uniquement
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
```

```ts
// src/main.ts (extrait)
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // supprime les props non décorées du DTO
      forbidNonWhitelisted: true, // 400 si prop inconnue envoyée
      transform: true,            // instancie la classe DTO (nécessaire pour @IsEnum etc.)
    }),
  )
  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
```

Points de validation par le coach : (a) `GET /items/abc` renvoie 400 avec le nom du paramètre dans le message — vérifie `metadata.data` ; (b) `DELETE /items/1` avec un `member` renvoie 403 — vérifie l'ordre guards ; (c) toute réponse 2xx est enveloppée dans `{ data: ... }` — vérifie `TransformInterceptor` ; (d) les erreurs 4xx respectent `{ success: false, statusCode, message, path }` — vérifie `HttpExceptionFilter` ; (e) le terminal affiche `→ DELETE /items/1` et `← DELETE /items/1 Nms` — vérifie `LoggingInterceptor`.

## Variante J+30 (fading)

Même exercice sans consulter le corrigé. Contraintes supplémentaires :

1. Ajouter un décorateur `@Public()` (`SetMetadata('isPublic', true)`) et modifier `AuthGuard` pour court-circuiter les routes marquées publiques — `GET /items` et `GET /items/:id` deviennent publiques via `@Public()` au lieu d'être non protégées. Utiliser `reflector.getAllAndOverride('isPublic', [handler, controller])`.

2. Modifier `TransformInterceptor` pour ajouter `path: request.url` et `timestamp: new Date().toISOString()` dans l'enveloppe. Le contrat devient `{ data, path, timestamp }` — mettre à jour les tests e2e existants.

3. Créer un `AllExceptionsFilter` (`@Catch()` sans argument) qui capture les erreurs non-HTTP (TypeError, etc.) et retourne 500 avec un message générique `'Erreur interne'` mais logue le stack complet côté serveur. L'enregistrer en dernier dans les providers (les filters s'exécutent du local vers le global — le filter `@Catch()` doit être le dernier recours).

Temps cible : 35 minutes sans le corrigé.

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `apps/api/src/common/` avec la structure décrire dans le module (guards, interceptors, pipes, decorators, filters).
2. Enregistre les guards et interceptors via `APP_GUARD` / `APP_INTERCEPTOR` dans `AppModule`.
3. Applique `@Roles('owner', 'admin')` sur `POST /families/:id/invite` et `@Roles('owner')` sur `DELETE /families/:id/members/:memberId`.
4. Vérifie que `GET /families` (public) répond 200 sans header, et que `POST /families/:id/invite` sans header répond 401.
5. Commit `smaurier/tribuzen` : `feat(common): AuthGuard + RolesGuard + TransformInterceptor + ValidationPipe global`.
