# Module 13 — NestJS — Pipes, Guards, Interceptors & Filters

> **Objectif** : Maîtriser les quatre couches de traitement transversal de NestJS pour valider, sécuriser, transformer et filtrer les requêtes de manière elegante et réutilisable.
> **Difficulte** : ⭐⭐⭐ (avance)
> **Prérequis** : Module 10 (Controllers & Routing), Module 11 (Services & Providers), Module 12 (Modules)
> **Duree estimee** : 6 heures

---

## 1. Vue d'ensemble : l'architecture en couches de NestJS

Avant de plonger dans chaque concept, il est crucial de comprendre **l'ordre d'exécution** complet d'une requête dans NestJS. C'est l'un des points les plus importants de ce module.

```
Requete HTTP entrante
        |
        v
   Middleware       (Module 12)
        |
        v
     Guards         (Autorisation)
        |
        v
  Interceptors      (Avant le handler)
        |
        v
     Pipes           (Validation / Transformation)
        |
        v
    Handler          (Methode du controller)
        |
        v
  Interceptors      (Apres le handler)
        |
        v
  Exception Filters (Si erreur)
        |
        v
   Reponse HTTP
```

> **Analogie** : Imaginez un aeroport. Le middleware est le hall d'entree (tout le monde passe). Le guard est le controle des passeports (avez-vous le droit d'entrer ?). L'interceptor est la douane (inspection avant et après). Le pipe est le scanner de bagages (validation du contenu). Le handler est votre destination finale. Et le filtre d'exception est le bureau des reclamations en cas de problème.

---

## 2. Les Pipes — Validation et Transformation

### 2.1 Qu'est-ce qu'un Pipe ?

Un **Pipe** est une classe annotee `@Injectable()` qui implemente l'interface `PipeTransform`. Il a deux fonctions principales :

1. **Transformation** : convertir les donnees d'entree (ex: string vers number)
2. **Validation** : vérifier que les donnees respectent certaines regles

```typescript
// Signature de l'interface PipeTransform
export interface PipeTransform<T = any, R = any> {
  transform(value: T, metadata: ArgumentMetadata): R;
}

// ArgumentMetadata contient des infos sur le parametre
export interface ArgumentMetadata {
  type: "body" | "query" | "param" | "custom";
  metatype?: Type<any>;
  data?: string;
}
```

### 2.2 Les Pipes integres a NestJS

NestJS fournit plusieurs pipes prets a l'emploi dans le package `@nestjs/common`.

#### ParseIntPipe

Convertit une chaine en entier. Lance une exception si la conversion echoue.

```typescript
import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";

@Controller("articles")
export class ArticlesController {
  // GET /articles/42
  // Le parametre 'id' sera automatiquement converti en number
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    // id est maintenant un number, pas un string
    console.log(typeof id); // 'number'
    return this.articlesService.findOne(id);
  }
}
```

Si on appelle `GET /articles/abc`, NestJS retourne automatiquement :

```json
{
  "statusCode": 400,
  "message": "Validation failed (numeric string is expected)",
  "error": "Bad Request"
}
```

On peut personnaliser le code d'erreur :

```typescript
@Get(':id')
findOne(
  @Param('id', new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE }))
  id: number,
) {
  return this.articlesService.findOne(id);
}
```

#### ParseUUIDPipe

Valide et passe un UUID (v3, v4 ou v5).

```typescript
import { ParseUUIDPipe } from '@nestjs/common';

@Get(':uuid')
findByUuid(@Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
  // uuid est garanti d'etre un UUID v4 valide
  return this.articlesService.findByUuid(uuid);
}
```

#### ParseBoolPipe

Convertit `'true'` ou `'false'` en boolean.

```typescript
import { ParseBoolPipe } from '@nestjs/common';

@Get()
findAll(@Query('published', new ParseBoolPipe({ optional: true })) published?: boolean) {
  // published est un boolean ou undefined
  return this.articlesService.findAll({ published });
}
```

#### ParseArrayPipe

Parse un tableau depuis un paramètre de requête.

```typescript
import { ParseArrayPipe } from '@nestjs/common';

@Get()
findByIds(
  @Query('ids', new ParseArrayPipe({ items: Number, separator: ',' }))
  ids: number[],
) {
  // GET /articles?ids=1,2,3 → ids = [1, 2, 3]
  return this.articlesService.findByIds(ids);
}
```

#### DefaultValuePipe

Fournit une valeur par defaut si le paramètre est `undefined` ou `null`.

```typescript
import { DefaultValuePipe, ParseIntPipe } from '@nestjs/common';

@Get()
findAll(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
) {
  // page = 1 et limit = 10 par defaut
  return this.articlesService.findAll(page, limit);
}
```

> **Bonne pratique** : Chainez `DefaultValuePipe` avant les autres pipes de transformation. Ainsi, les pipes suivants recevront toujours une valeur valide.

### 2.3 ValidationPipe et class-validator

Le `ValidationPipe` est le pipe le plus puissant et le plus utilise. Il s'appuie sur les bibliotheques `class-validator` et `class-transformer` pour valider automatiquement les DTOs.

#### Installation

```bash
npm install class-validator class-transformer
```

#### Configuration du ValidationPipe global

```typescript
// main.ts
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuration globale du ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les proprietes non decorees
      forbidNonWhitelisted: true, // Lance une erreur si propriete inconnue
      transform: true, // Transforme automatiquement les types
      transformOptions: {
        enableImplicitConversion: true, // Conversion automatique des types primitifs
      },
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

| Option                 | Description                                 | Valeur recommandee           |
| ---------------------- | ------------------------------------------- | ---------------------------- |
| `whitelist`            | Supprime les propriétés non decorees du DTO | `true`                       |
| `forbidNonWhitelisted` | Erreur 400 si propriété inconnue            | `true`                       |
| `transform`            | Transformation automatique des types        | `true`                       |
| `disableErrorMessages` | Masque les details d'erreur                 | `false` (dev), `true` (prod) |
| `exceptionFactory`     | Fonction custom pour formater les erreurs   | selon besoin                 |

> **Piege classique** : Si vous oubliez `whitelist: true`, un utilisateur malveillant peut envoyer des propriétés supplementaires (comme `isAdmin: true`) qui seront transmises a votre service. Toujours activer le whitelist !

#### Les decorateurs de class-validator

Voici un DTO complet avec les decorateurs les plus courants :

```typescript
// dto/create-user.dto.ts
import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsUrl,
  IsPhoneNumber,
  Matches,
  IsNotEmpty,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";

// Enumeration pour le role
export enum UserRole {
  ADMIN = "admin",
  USER = "user",
  MODERATOR = "moderator",
}

// DTO d'adresse imbrique
export class AddressDto {
  @IsString()
  @IsNotEmpty()
  rue: string;

  @IsString()
  @IsNotEmpty()
  ville: string;

  @IsString()
  @Matches(/^\d{5}$/, { message: "Le code postal doit contenir 5 chiffres" })
  codePostal: string;

  @IsString()
  @IsOptional()
  complement?: string;
}

// DTO principal de creation d'utilisateur
export class CreateUserDto {
  @IsString({ message: "Le prenom doit etre une chaine de caracteres" })
  @MinLength(2, { message: "Le prenom doit contenir au moins 2 caracteres" })
  @MaxLength(50, { message: "Le prenom ne doit pas depasser 50 caracteres" })
  prenom: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nom: string;

  @IsEmail({}, { message: "L'email fourni n'est pas valide" })
  email: string;

  @IsString()
  @MinLength(8, {
    message: "Le mot de passe doit contenir au moins 8 caracteres",
  })
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/, {
    message:
      "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre",
  })
  motDePasse: string;

  @IsEnum(UserRole, { message: "Le role doit etre admin, user ou moderator" })
  @IsOptional()
  role?: UserRole;

  @IsInt()
  @Min(18, { message: "L'utilisateur doit avoir au moins 18 ans" })
  @Max(120)
  @IsOptional()
  age?: number;

  @IsBoolean()
  @IsOptional()
  actif?: boolean;

  @IsDateString()
  @IsOptional()
  dateNaissance?: string;

  @IsUrl()
  @IsOptional()
  siteWeb?: string;

  @IsPhoneNumber("FR")
  @IsOptional()
  telephone?: string;

  @IsArray()
  @IsString({ each: true }) // Valide chaque element du tableau
  @ArrayMinSize(1, { message: "Au moins un tag est requis" })
  @ArrayMaxSize(5, { message: "Maximum 5 tags autorises" })
  @IsOptional()
  tags?: string[];

  // Validation d'objet imbrique
  @ValidateNested()
  @Type(() => AddressDto) // Necessaire pour class-transformer
  @IsOptional()
  adresse?: AddressDto;
}
```

#### Le DTO de mise a jour avec PartialType

```typescript
// dto/update-user.dto.ts
import { PartialType } from "@nestjs/mapped-types";
import { CreateUserDto } from "./create-user.dto";

// Tous les champs deviennent optionnels automatiquement
export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

> **A retenir** : `PartialType` de `@nestjs/mapped-types` copie tous les decorateurs de validation mais rend chaque propriété optionnelle. C'est la manière idiomatique de créer un DTO de mise a jour.

#### Tableau récapitulatif des decorateurs class-validator

| Decorateur           | Description                      | Exemple                              |
| -------------------- | -------------------------------- | ------------------------------------ |
| `@IsString()`        | Doit etre une chaine             | `@IsString()`                        |
| `@IsNumber()`        | Doit etre un nombre              | `@IsNumber({ maxDecimalPlaces: 2 })` |
| `@IsInt()`           | Doit etre un entier              | `@IsInt()`                           |
| `@IsBoolean()`       | Doit etre un booleen             | `@IsBoolean()`                       |
| `@IsEmail()`         | Doit etre un email valide        | `@IsEmail()`                         |
| `@IsEnum(enum)`      | Doit etre une valeur de l'enum   | `@IsEnum(Role)`                      |
| `@IsOptional()`      | Champ optionnel                  | `@IsOptional()`                      |
| `@IsNotEmpty()`      | Ne doit pas etre vide            | `@IsNotEmpty()`                      |
| `@MinLength(n)`      | Longueur minimale                | `@MinLength(3)`                      |
| `@MaxLength(n)`      | Longueur maximale                | `@MaxLength(100)`                    |
| `@Min(n)`            | Valeur minimale                  | `@Min(0)`                            |
| `@Max(n)`            | Valeur maximale                  | `@Max(999)`                          |
| `@Matches(regex)`    | Doit matcher la regex            | `@Matches(/^\d+$/)`                  |
| `@IsUrl()`           | Doit etre une URL                | `@IsUrl()`                           |
| `@IsDateString()`    | Doit etre une date ISO           | `@IsDateString()`                    |
| `@IsArray()`         | Doit etre un tableau             | `@IsArray()`                         |
| `@ValidateNested()`  | Valide l'objet imbrique          | `@ValidateNested()`                  |
| `@Type(() => Class)` | Transforme en instance de classe | `@Type(() => AddressDto)`            |

### 2.4 Créer un Pipe personnalise

Parfois, les pipes integres ne suffisent pas. Voici comment en créer un sur mesure.

```typescript
// pipes/parse-objectid.pipe.ts
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from "@nestjs/common";
import { Types } from "mongoose";

// Pipe pour valider un ObjectId MongoDB
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    // Verifie que la valeur est un ObjectId MongoDB valide
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(
        `La valeur "${value}" n'est pas un ObjectId MongoDB valide`,
      );
    }
    return value;
  }
}
```

Utilisation :

```typescript
@Get(':id')
findOne(@Param('id', ParseObjectIdPipe) id: string) {
  return this.service.findOne(id);
}
```

Un autre exemple — un pipe qui nettoie les chaines de caracteres :

```typescript
// pipes/trim-strings.pipe.ts
import { PipeTransform, Injectable, ArgumentMetadata } from "@nestjs/common";

@Injectable()
export class TrimStringsPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // Ne traite que les body
    if (metadata.type !== "body" || typeof value !== "object") {
      return value;
    }

    // Parcourt toutes les proprietes et trim les chaines
    const trimmed: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      trimmed[key] = typeof val === "string" ? val.trim() : val;
    }
    return trimmed;
  }
}
```

### 2.5 Pipe de validation avec fichier upload

```typescript
// pipes/file-validation.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(
    private readonly allowedMimeTypes: string[] = ["image/jpeg", "image/png"],
    private readonly maxSizeInBytes: number = 5 * 1024 * 1024, // 5 Mo
  ) {}

  transform(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Aucun fichier fourni");
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Type de fichier non autorise. Types acceptes : ${this.allowedMimeTypes.join(", ")}`,
      );
    }

    if (file.size > this.maxSizeInBytes) {
      const maxSizeMo = this.maxSizeInBytes / (1024 * 1024);
      throw new BadRequestException(
        `Le fichier depasse la taille maximale de ${maxSizeMo} Mo`,
      );
    }

    return file;
  }
}
```

---

## 3. Les Guards — Autorisation et Controle d'acces

### 3.1 Qu'est-ce qu'un Guard ?

Un **Guard** est une classe annotee `@Injectable()` qui implemente l'interface `CanActivate`. Sa responsabilite unique est de déterminer si une requête peut continuer vers le handler ou non.

```typescript
export interface CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean>;
}
```

> **Analogie** : Le guard est comme un videur de boite de nuit. Il regarde votre identite (le token JWT par exemple) et decide : "Vous entrez" (`true`) ou "Vous n'entrez pas" (`false`, ce qui lance une `ForbiddenException`).

### 3.2 ExecutionContext

L'`ExecutionContext` etend `ArgumentsHost` et fournit des méthodes supplementaires :

```typescript
// L'ExecutionContext vous donne acces a tout
export interface ExecutionContext extends ArgumentsHost {
  getClass<T = any>(): Type<T>; // La classe du controller
  getHandler(): Function; // La methode du handler
}
```

Exemple d'utilisation :

```typescript
const request = context.switchToHttp().getRequest();
const response = context.switchToHttp().getResponse();
const controllerClass = context.getClass();
const handlerMethod = context.getHandler();
```

### 3.3 Guard d'authentification simple

```typescript
// guards/auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Token manquant");
    }

    // Ici, on verifierait le token JWT (voir Module 19)
    // Pour l'exemple, on verifie juste qu'il existe
    try {
      // const payload = this.jwtService.verify(token);
      // request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Token invalide");
    }
  }

  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(" ");
    return type === "Bearer" ? token : undefined;
  }
}
```

### 3.4 Guard base sur les roles avec @SetMetadata et Reflector

C'est un pattern fondamental dans NestJS. On utilise des **metadonnees** pour définir quels roles ont acces à une route.

#### Étape 1 : Créer le decorateur @Roles

```typescript
// decorators/roles.decorator.ts
import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

// Decorateur personnalise pour definir les roles autorises
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

#### Étape 2 : Créer le RolesGuard

```typescript
// guards/roles.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  // Le Reflector permet de lire les metadonnees
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Recupere les roles definis sur le handler OU le controller
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si aucun role requis, la route est accessible a tous
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Recupere l'utilisateur depuis la requete (mis par AuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Utilisateur non authentifie");
    }

    // Verifie si l'utilisateur a au moins un des roles requis
    const hasRole = requiredRoles.some((role) => user.roles?.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Acces refuse. Roles requis : ${requiredRoles.join(", ")}`,
      );
    }

    return true;
  }
}
```

#### Étape 3 : Utilisation dans un controller

```typescript
// controllers/admin.controller.ts
import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../guards/auth.guard";
import { RolesGuard } from "../guards/roles.guard";
import { Roles } from "../decorators/roles.decorator";

@Controller("admin")
@UseGuards(AuthGuard, RolesGuard) // Les deux guards s'executent dans l'ordre
export class AdminController {
  @Get("dashboard")
  @Roles("admin", "moderator") // Seuls admin et moderator peuvent acceder
  getDashboard() {
    return { message: "Bienvenue sur le dashboard admin" };
  }

  @Post("users/ban")
  @Roles("admin") // Seul l'admin peut bannir
  banUser() {
    return { message: "Utilisateur banni" };
  }

  @Get("stats")
  // Pas de @Roles => accessible a tous les utilisateurs authentifies
  getStats() {
    return { message: "Statistiques generales" };
  }
}
```

> **Piege classique** : L'ordre des guards dans `@UseGuards()` est important. `AuthGuard` doit s'exécuter **avant** `RolesGuard` car ce dernier a besoin de `request.user` qui est défini par le premier.

### 3.5 Niveaux d'application des Guards

```typescript
// 1. Niveau global (main.ts)
app.useGlobalGuards(new AuthGuard());

// 2. Niveau global via module (recommande pour l'injection de dependances)
// app.module.ts
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}

// 3. Niveau controller
@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {}

// 4. Niveau handler (methode)
@Get()
@UseGuards(AuthGuard)
findAll() {}
```

> **Bonne pratique** : Utilisez `APP_GUARD` dans le module plutot que `app.useGlobalGuards()` dans main.ts. Cela permet l'injection de dépendances (comme le `Reflector` ou un `JwtService`) dans votre guard.

---

## 4. Les Interceptors — Logique transversale

### 4.1 Qu'est-ce qu'un Interceptor ?

Un **Interceptor** est une classe annotee `@Injectable()` qui implemente `NestInterceptor`. Il peut exécuter de la logique **avant** et **après** l'exécution du handler, et peut même **transformer** la réponse.

```typescript
export interface NestInterceptor<T = any, R = any> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<R>;
}
```

Le `CallHandler` expose la méthode `handle()` qui retourne un `Observable`. C'est grâce à cet Observable (RxJS) qu'on peut agir avant et après le handler.

> **Analogie** : L'interceptor est comme un emballage cadeau. Vous pouvez faire quelque chose **avant** de mettre le cadeau dans la boite (preparer le papier), laisser le cadeau se créer (le handler), puis faire quelque chose **après** (fermer la boite, ajouter un ruban).

### 4.2 Interceptor de logging

```typescript
// interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const now = Date.now();

    // --- AVANT le handler ---
    this.logger.log(`→ ${method} ${url} — Debut du traitement`);

    return next.handle().pipe(
      // --- APRES le handler ---
      tap({
        next: (data) => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const duration = Date.now() - now;
          this.logger.log(`← ${method} ${url} ${statusCode} — ${duration}ms`);
        },
        error: (error) => {
          const duration = Date.now() - now;
          this.logger.error(
            `✗ ${method} ${url} — ${duration}ms — Erreur: ${error.message}`,
          );
        },
      }),
    );
  }
}
```

### 4.3 Interceptor de transformation de réponse

Un pattern très courant : envelopper toutes les réponses dans un format uniforme.

```typescript
// interceptors/transform-response.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

// Interface de la reponse standardisee
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  path: string;
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
        path: request.url,
      })),
    );
  }
}
```

Résultat avant :

```json
[
  { "id": 1, "nom": "Alice" },
  { "id": 2, "nom": "Bob" }
]
```

Résultat après avec l'interceptor :

```json
{
  "success": true,
  "data": [
    { "id": 1, "nom": "Alice" },
    { "id": 2, "nom": "Bob" }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/users"
}
```

### 4.4 Interceptor de timeout

```typescript
// interceptors/timeout.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from "@nestjs/common";
import { Observable, throwError, TimeoutError } from "rxjs";
import { catchError, timeout } from "rxjs/operators";

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly timeoutMs: number = 5000) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                `La requete a depasse le delai de ${this.timeoutMs}ms`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
```

### 4.5 Interceptor de cache simple

```typescript
// interceptors/cache.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class SimpleCacheInterceptor implements NestInterceptor {
  // Cache en memoire simple (en production, utilisez Redis)
  private cache = new Map<string, { data: any; expiry: number }>();

  constructor(private readonly ttlSeconds: number = 60) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Ne cache que les requetes GET
    if (request.method !== "GET") {
      return next.handle();
    }

    const cacheKey = request.url;
    const cached = this.cache.get(cacheKey);

    // Si le cache est valide, retourne directement
    if (cached && cached.expiry > Date.now()) {
      return of(cached.data);
    }

    // Sinon, execute le handler et met en cache
    return next.handle().pipe(
      tap((data) => {
        this.cache.set(cacheKey, {
          data,
          expiry: Date.now() + this.ttlSeconds * 1000,
        });
      }),
    );
  }
}
```

### 4.6 Application des interceptors

```typescript
// 1. Niveau global (main.ts)
app.useGlobalInterceptors(new LoggingInterceptor());

// 2. Niveau global via module
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}

// 3. Niveau controller
@UseInterceptors(LoggingInterceptor)
@Controller('users')
export class UsersController {}

// 4. Niveau handler
@Get()
@UseInterceptors(LoggingInterceptor)
findAll() {}
```

---

## 5. Les Exception Filters — Gestion des erreurs

### 5.1 Le système d'exceptions de NestJS

NestJS possede une couche de gestion d'exceptions intégrée. Par defaut, toute exception non gérée est interceptee et transformee en réponse JSON.

#### Hiérarchie des exceptions HTTP

```typescript
// Toutes heritent de HttpException
HttpException
  ├── BadRequestException          // 400
  ├── UnauthorizedException        // 401
  ├── ForbiddenException           // 403
  ├── NotFoundException            // 404
  ├── MethodNotAllowedException    // 405
  ├── NotAcceptableException       // 406
  ├── RequestTimeoutException      // 408
  ├── ConflictException            // 409
  ├── GoneException                // 410
  ├── PayloadTooLargeException     // 413
  ├── UnsupportedMediaTypeException // 415
  ├── UnprocessableEntityException // 422
  ├── InternalServerErrorException // 500
  ├── NotImplementedException      // 501
  ├── BadGatewayException          // 502
  ├── ServiceUnavailableException  // 503
  └── GatewayTimeoutException      // 504
```

#### Utilisation des exceptions integrees

```typescript
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";

@Injectable()
export class UsersService {
  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Utilisateur #${id} introuvable`);
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    // Verifier l'unicite de l'email
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException("Cet email est deja utilise");
    }
    return this.userRepository.save(dto);
  }
}
```

### 5.2 Créer une exception personnalisee

```typescript
// exceptions/business.exception.ts
import { HttpException, HttpStatus } from "@nestjs/common";

export class BusinessException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    statusCode: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
  ) {
    super(
      {
        statusCode,
        code,
        message,
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }
}

// exceptions/insufficient-stock.exception.ts
export class InsufficientStockException extends BusinessException {
  constructor(productId: number, requested: number, available: number) {
    super(
      "INSUFFICIENT_STOCK",
      `Stock insuffisant pour le produit #${productId}. ` +
        `Demande : ${requested}, Disponible : ${available}`,
    );
  }
}
```

### 5.3 Créer un Exception Filter personnalise

```typescript
// filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Construction de la reponse d'erreur
    const errorResponse = {
      success: false,
      statusCode: status,
      message:
        typeof exceptionResponse === "string"
          ? exceptionResponse
          : (exceptionResponse as any).message,
      error:
        typeof exceptionResponse === "object"
          ? (exceptionResponse as any).error
          : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // Log de l'erreur
    this.logger.error(
      `${request.method} ${request.url} ${status} — ${JSON.stringify(errorResponse.message)}`,
    );

    response.status(status).json(errorResponse);
  }
}
```

### 5.4 Filter global pour TOUTES les exceptions

```typescript
// filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

// @Catch() sans argument capture TOUTES les exceptions
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("AllExceptionsFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      // Exception HTTP connue
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === "string"
          ? exceptionResponse
          : (exceptionResponse as any).message;
    } else if (exception instanceof Error) {
      // Erreur JavaScript standard
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Erreur interne du serveur";

      // Log de l'erreur complete en dev
      this.logger.error(
        `Erreur non geree : ${exception.message}`,
        exception.stack,
      );
    } else {
      // Autre chose
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Erreur inconnue";
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

### 5.5 Application des filters

```typescript
// 1. Niveau global (main.ts)
app.useGlobalFilters(new AllExceptionsFilter());

// 2. Niveau global via module (avec injection de dependances)
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}

// 3. Niveau controller
@UseFilters(HttpExceptionFilter)
@Controller('users')
export class UsersController {}

// 4. Niveau handler
@Post()
@UseFilters(HttpExceptionFilter)
create(@Body() dto: CreateUserDto) {}
```

---

## 6. Ordre d'exécution complet et récapitulatif

### 6.1 Le cycle de vie complet

Voici l'ordre **exact** d'exécution pour une requête NestJS :

```
1. Middleware global
2. Middleware de module
3. Guards globaux
4. Guards de controller
5. Guards de route
6. Interceptors globaux (pre-handler)
7. Interceptors de controller (pre-handler)
8. Interceptors de route (pre-handler)
9. Pipes globaux
10. Pipes de controller
11. Pipes de route
12. Pipes de parametre
13. Handler (methode du controller)
14. Interceptors de route (post-handler)
15. Interceptors de controller (post-handler)
16. Interceptors globaux (post-handler)
17. Exception Filters de route (si erreur)
18. Exception Filters de controller (si erreur)
19. Exception Filters globaux (si erreur)
```

> **A retenir** : Les guards et interceptors s'executent du **global vers le local** (avant le handler). Les interceptors post-handler et les filters s'executent du **local vers le global** (bulle vers l'exterieur).

### 6.2 Tableau comparatif

| Concept     | Interface         | Méthode         | Role principal                 | Peut arreter la requête ?     |
| ----------- | ----------------- | --------------- | ------------------------------ | ----------------------------- |
| Middleware  | `NestMiddleware`  | `use()`         | Logique transversale générique | Oui (ne pas appeler `next()`) |
| Guard       | `CanActivate`     | `canActivate()` | Autorisation                   | Oui (retourner `false`)       |
| Interceptor | `NestInterceptor` | `intercept()`   | Transformation avant/après     | Oui (via Observable)          |
| Pipe        | `PipeTransform`   | `transform()`   | Validation/Transformation      | Oui (lancer une exception)    |
| Filter      | `ExceptionFilter` | `catch()`       | Gestion d'erreurs              | Non (agit sur les erreurs)    |

### 6.3 Quand utiliser quoi ?

| Besoin                                        | Solution                  |
| --------------------------------------------- | ------------------------- |
| Journalisation de chaque requête              | Middleware ou Interceptor |
| Vérification du token JWT                     | Guard                     |
| Vérification des roles/permissions            | Guard                     |
| Validation des donnees d'entree               | Pipe (ValidationPipe)     |
| Transformation de paramètre (string → number) | Pipe                      |
| Ajout de headers à la réponse                 | Interceptor               |
| Mise en cache des réponses                    | Interceptor               |
| Mesure du temps de réponse                    | Interceptor               |
| Format uniforme des erreurs                   | Exception Filter          |
| Gestion des erreurs business                  | Exception Filter          |

---

## 7. Exemple complet — Tout combiner

Voici un exemple qui utilise tous les concepts ensemble :

```typescript
// === main.ts ===
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Pipes globaux
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

```typescript
// === app.module.ts ===
import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from "@nestjs/core";
import { AuthGuard } from "./guards/auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { LoggingInterceptor } from "./interceptors/logging.interceptor";
import { TransformResponseInterceptor } from "./interceptors/transform-response.interceptor";
import { AllExceptionsFilter } from "./filters/all-exceptions.filter";
import { ProductsModule } from "./products/products.module";

@Module({
  imports: [ProductsModule],
  providers: [
    // L'ordre des providers APP_GUARD determine l'ordre d'execution
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Interceptors globaux
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    // Filtre d'exception global
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
```

```typescript
// === products/products.controller.ts ===
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseInterceptors,
} from "@nestjs/common";
import { Roles } from "../decorators/roles.decorator";
import { Public } from "../decorators/public.decorator";
import { TimeoutInterceptor } from "../interceptors/timeout.interceptor";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Route publique (pas besoin d'authentification)
  @Public()
  @Get()
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.productsService.findAll(page, limit);
  }

  @Public()
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  // Seul un admin peut creer un produit
  @Post()
  @Roles("admin")
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  // Admin ou moderateur peuvent modifier
  @Put(":id")
  @Roles("admin", "moderator")
  @UseInterceptors(new TimeoutInterceptor(10000)) // 10s de timeout pour cette route
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  // Seul l'admin peut supprimer
  @Delete(":id")
  @Roles("admin")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}
```

```typescript
// === decorators/public.decorator.ts ===
// Decorateur pour marquer une route comme publique (pas d'auth requise)
import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// === guards/auth.guard.ts (version mise a jour) ===
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Verifie si la route est marquee comme publique
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // Pas besoin d'authentification
    }

    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(" ")[1];

    if (!token) {
      throw new UnauthorizedException("Token d'authentification requis");
    }

    // Verification du token (simplifiee pour l'exemple)
    // En production, on utiliserait JwtService (voir Module 19)
    request.user = { id: 1, roles: ["admin"] }; // Simule un user decode
    return true;
  }
}
```

---

## 8. Exercices pratiques

### Exercice 1 : Pipe de transformation

Creez un pipe `ParseSlugPipe` qui transforme une chaine en slug (minuscule, sans accents, espaces remplacees par des tirets).

### Exercice 2 : Guard d'API Key

Creez un guard `ApiKeyGuard` qui vérifié la presence d'une clé API dans le header `x-api-key` et la compare à une variable d'environnement.

### Exercice 3 : Interceptor de serialisation

Creez un interceptor qui supprime automatiquement les champs `motDePasse` et `__v` de toutes les réponses.

### Exercice 4 : Filter spécifique

Creez un `DatabaseExceptionFilter` qui capture les erreurs TypeORM (comme les violations de contrainte unique) et retourne des messages utilisateur lisibles.

---

## Bonus — Patterns BFF avec NestJS

NestJS est tres adapte au BFF car le pipeline request/response permet de centraliser les besoins transverses frontend sans polluer la logique metier.

### 1) Guard BFF pour contexte utilisateur

```typescript
@Injectable()
export class BffContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      throw new UnauthorizedException("Utilisateur non authentifie");
    }

    // Contexte utile a tous les handlers BFF
    req.bffContext = {
      userId: user.id,
      locale: req.headers["x-locale"] || "fr-FR",
      correlationId: req.headers["x-correlation-id"],
    };

    return true;
  }
}
```

### 2) Interceptor de degradation gracieuse

```typescript
@Injectable()
export class UpstreamFallbackInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err) => {
        // Mapper une panne upstream vers une reponse exploitable par le front
        if (err?.code === "UPSTREAM_TIMEOUT") {
          return of({
            partial: true,
            data: null,
            warning: "Une partie des donnees est temporairement indisponible",
          });
        }
        return throwError(() => err);
      }),
    );
  }
}
```

### 3) Pipeline BFF conseille dans Nest

| Etape                   | Responsabilite                      |
| ----------------------- | ----------------------------------- |
| Guard                   | Contexte user/session/tenant        |
| Pipe                    | Validation stricte DTO d'entree     |
| Service d'orchestration | Appels multi-API + mapping payload  |
| Interceptor             | Timeout, fallback, shape de reponse |
| Filter                  | Contrat d'erreur unique front       |

> **A retenir BFF** : Avec Nest, les Guards/Pipes/Interceptors/Filters permettent de construire un BFF tres lisible et maintenable, avec des responsabilites nettes par couche.

---

## Liens

| Ressource                                    | Lien                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| Quiz Module 13                               | `quiz/13-quiz.md`                                                          |
| Lab Module 13                                | `labs/13-lab-pipes-guards.md`                                              |
| Screencast                                   | `screencasts/13-screencast.md`                                             |
| Module précédent                             | [Module 12 — Modules & Architecture](12-nestjs-modules-architecture.md)    |
| Module suivant                               | [Module 14 — TypeORM Entites & Relations](14-typeorm-entites-relations.md) |
| Documentation officielle — Pipes             | https://docs.nestjs.com/pipes                                              |
| Documentation officielle — Guards            | https://docs.nestjs.com/guards                                             |
| Documentation officielle — Interceptors      | https://docs.nestjs.com/interceptors                                       |
| Documentation officielle — Exception Filters | https://docs.nestjs.com/exception-filters                                  |
| class-validator                              | https://github.com/typestack/class-validator                               |
| class-transformer                            | https://github.com/typestack/class-transformer                             |

---

<!-- parcours-recommande -->

::: tip Parcours recommandé

1. **Screencast** : [screencast 13 pipes guards](../screencasts/screencast-13-pipes-guards.md)
2. **Lab** : [lab-13-pipes-guards](../labs/lab-13-pipes-guards/README)
3. **Visualisation** : [NestJS Lifecycle](../visualizations/nestjs-lifecycle.html)
4. **Quiz** : [quiz 13 pipes guards](../quizzes/quiz-13-pipes-guards.html)
   :::
