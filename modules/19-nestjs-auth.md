---
titre: NestJS auth
cours: 09-nestjs
notions: [Passport avec NestJS, stratégie locale login, stratégie JWT, module jwt et signature, AuthGuard et UseGuards, guard JWT global, refresh token, autorisation par rôles avec un RolesGuard, hachage bcrypt]
outcomes: [implémenter un login avec Passport et émettre un JWT, protéger des routes avec un guard JWT, gérer le refresh token, autoriser par rôle avec un RolesGuard]
prerequis: [18-nestjs-testing]
next: 20-nestjs-config-swagger
libs: [{ name: "@nestjs/passport", version: "^11" }, { name: "@nestjs/jwt", version: "^11" }, { name: passport-jwt, version: "^4" }]
tribuzen: authentification JWT de l'API TribuZen (login parent, guard JWT, RolesGuard admin/membre)
last-reviewed: 2026-07
---

# NestJS auth

> **Outcomes — tu sauras FAIRE :** implémenter un login avec Passport et émettre un JWT, protéger des routes avec un guard JWT global, gérer le refresh token avec rotation sécurisée, autoriser par rôle avec un `RolesGuard`.
> **Difficulté :** :star::star::star::star:

## 1. Cas concret d'abord

TribuZen a besoin d'authentification. Un parent crée un compte, se connecte, et toutes les routes de gestion de famille (`POST /families`, `GET /families/:id/members`) doivent être protégées — seul un parent connecté peut les appeler. Les admins ont en plus accès aux routes de modération.

Tu essaies d'écrire le controller sans auth :

```ts
// ❌ naïf — aucune protection, n'importe qui peut créer une famille
@Post('families')
create(@Body() dto: CreateFamilyDto) {
  return this.familyService.create(dto)
  // Pas d'identité liée à l'appelant — injection possible
}
```

Avec NestJS + Passport + JWT, la route devient :

```ts
// ✅ protégée — l'identité est vérifiée avant d'entrer dans le handler
@Post('families')
create(@Body() dto: CreateFamilyDto, @CurrentUser() user: AuthUser) {
  // user.id vient du JWT vérifié par JwtStrategy.validate()
  return this.familyService.create(dto, user.id)
}
```

Ce module explique la chaîne complète : `LocalStrategy` pour le login email/password, `JwtService` pour signer un access token, `JwtStrategy` pour le vérifier à chaque requête, `JwtAuthGuard` global pour protéger toutes les routes par défaut, refresh token avec rotation, et `RolesGuard` pour l'autorisation par rôle.

## 2. Théorie complète, concise

### 2.1 Passport avec NestJS — PassportStrategy et AuthGuard

`@nestjs/passport` est le pont entre Passport.js et NestJS. Il fournit deux éléments centraux :

- `PassportStrategy(Strategy, name?)` — classe de base à étendre pour créer une stratégie. `Strategy` vient du package Passport (`passport-local`, `passport-jwt`, etc.). Le deuxième argument optionnel `name` permet de nommer la stratégie (utile pour plusieurs stratégies JWT distinctes).
- `AuthGuard(name)` — factory qui retourne un guard NestJS utilisant la stratégie nommée. `AuthGuard('local')` déclenche `LocalStrategy.validate()`.

Le cycle d'une requête avec Passport :

```
Requête → AuthGuard.canActivate() → Passport invoque Strategy.validate()
  → validate() lève une exception → 401 Unauthorized automatique
  → validate() retourne un objet → request.user = objet → handler appelé
```

### 2.2 Stratégie locale — login email/mot de passe

`LocalStrategy` gère le `POST /auth/login`. Elle extrait les champs email et password du body et appelle `validateUser()` qui compare le mot de passe haché en base.

```ts
// auth/strategies/local.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-local'
import { AuthService } from '../auth.service'

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',    // Passport cherche 'username' par défaut — on remplace
      passwordField: 'password',
    })
  }

  // Passport appelle validate() automatiquement avec les champs extraits du body
  // Retour → request.user ; exception → 401 automatique
  async validate(email: string, password: string) {
    const user = await this.authService.validateUser(email, password)
    if (!user) throw new UnauthorizedException('Identifiants invalides')
    return user // → request.user dans le handler login
  }
}
```

### 2.3 Hachage bcrypt

Les mots de passe ne sont **jamais** stockés en clair. `bcrypt` produit un hash avec un salt intégré et un facteur de coût (cost factor) qui ralentit délibérément le calcul — chaque augmentation d'une unité double le temps de calcul.

```ts
import * as bcrypt from 'bcrypt'

// Hachage à l'inscription — cost factor 10 ≈ 100 ms sur un serveur moderne
const hash = await bcrypt.hash(password, 10)
// → '$2b$10$...' — le hash inclut le salt, l'algorithme et le cost factor

// Vérification au login — constant-time (résistant aux attaques par timing)
const isValid = await bcrypt.compare(plainPassword, storedHash)
// → true ou false — ne jamais comparer avec ===
```

| Cost factor | Temps approx. | Usage |
|-------------|--------------|-------|
| 8 | ~40 ms | Tests uniquement |
| 10 | ~100 ms | Production standard |
| 12 | ~300 ms | Sécurité renforcée |

### 2.4 `@nestjs/jwt` et signature d'un access token

`JwtModule.registerAsync` configure le service JWT à partir de `ConfigService` — le secret ne doit **jamais** être écrit en dur dans le code source.

```ts
// auth/auth.module.ts (extrait)
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'

JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    // Secret lu depuis les variables d'environnement — jamais hardcodé
    secret: config.get<string>('JWT_ACCESS_SECRET'),
    signOptions: {
      expiresIn: config.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
    },
  }),
})
```

`JwtService.signAsync(payload)` signe le payload avec le secret configuré et retourne un JWT string. Le payload est encodé en Base64URL — il **n'est pas chiffré** et n'importe qui peut le décoder. Ne jamais y mettre de mot de passe, de numéro de carte, ou de donnée sensible.

```ts
const payload = { sub: user.id, email: user.email, role: user.role }
const accessToken = await this.jwtService.signAsync(payload)
// → 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### 2.5 Stratégie JWT — JwtStrategy

`JwtStrategy` vérifie chaque requête protégée. Passport extrait le token du header `Authorization: Bearer <token>`, vérifie la signature et l'expiration, puis appelle `validate()` avec le payload décodé.

```ts
// auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'

export interface JwtPayload {
  sub: number
  email: string
  role: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      // Extrait le token du header Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // ⚠️ Ne jamais passer ignoreExpiration: true — les tokens expirés seraient acceptés
      ignoreExpiration: false,
      // Secret identique à celui utilisé pour signer — lu depuis ConfigService
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    })
  }

  // Appelé APRÈS que Passport a vérifié la signature et l'expiration
  // payload = contenu décodé du JWT
  async validate(payload: JwtPayload) {
    // Ce qui est retourné ici devient request.user dans tous les handlers protégés
    return { id: payload.sub, email: payload.email, role: payload.role }
  }
}
```

### 2.6 `AuthGuard`, `UseGuards` et guard JWT global

`@UseGuards(JwtAuthGuard)` sur une route déclenche `JwtStrategy.validate()` avant le handler. Mais décorer chaque route est répétitif et dangereux — une route oubliée serait non protégée.

Solution idiomatique : enregistrer `JwtAuthGuard` comme **guard global** via `APP_GUARD` dans `AppModule`. Toutes les routes sont protégées par défaut. Les routes publiques (login, register) sont exemptées avec le décorateur `@Public()`.

```ts
// app.module.ts — guard global : toutes les routes protégées par défaut
import { APP_GUARD } from '@nestjs/core'
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard'
import { RolesGuard } from './auth/guards/roles.guard'

@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // vérifie le JWT sur toutes les routes
    { provide: APP_GUARD, useClass: RolesGuard },   // vérifie les rôles après le JWT
  ],
})
export class AppModule {}
```

```ts
// auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Reflector } from '@nestjs/core'

export const IS_PUBLIC_KEY = 'isPublic'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) { super() }

  canActivate(context: ExecutionContext) {
    // Vérifie si la route est marquée @Public() — si oui, pas de vérification JWT
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    return super.canActivate(context) // déclenche JwtStrategy.validate()
  }
}
```

```ts
// auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'
// @Public() exempte une route du guard JWT global
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
```

### 2.7 Refresh token — secret distinct, rotation, stockage haché

L'access token a une courte durée de vie (15 min) pour limiter l'impact d'un vol. Le refresh token (7 jours) permet de renouveler l'access token sans re-saisir les identifiants.

Trois règles de sécurité non négociables :

1. **Secret distinct** — `JWT_REFRESH_SECRET` ≠ `JWT_ACCESS_SECRET`. Si l'un est compromis, l'autre reste valide et les usages sont cloisonnés.
2. **Stockage haché** — le refresh token brut n'est jamais persisté en base. On stocke `bcrypt.hash(refreshToken, 10)`. En cas de fuite de la base, les tokens sont inutilisables.
3. **Rotation** — à chaque usage du refresh token, un nouveau RT est émis et l'ancien est invalidé. Si un attaquant utilise un RT volé, l'utilisateur légitime détecte l'invalidation à son prochain refresh.

```ts
// Génération — deux tokens, deux secrets, deux durées
private async generateTokens(user: AuthUser) {
  const payload = { sub: user.id, email: user.email, role: user.role }
  const [accessToken, refreshToken] = await Promise.all([
    this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    }),
    this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'), // ← secret distinct
      expiresIn: '7d',
    }),
  ])
  return { accessToken, refreshToken }
}
```

### 2.8 Autorisation par rôles — RolesGuard

L'authentification répond à « qui êtes-vous ? » ; l'autorisation répond à « avez-vous le droit ? ». `RolesGuard` utilise `Reflector` pour lire les métadonnées posées par `@Roles()` sur le handler ou le controller.

```ts
// auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common'

export const ROLES_KEY = 'roles'
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)
```

```ts
// auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '../decorators/roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    // Pas de @Roles() → accès libre pour tout utilisateur authentifié
    if (!requiredRoles?.length) return true

    const { user } = context.switchToHttp().getRequest()
    // user.role positionné par JwtStrategy.validate() — jamais undefined ici
    // car JwtAuthGuard s'exécute en amont (ordre APP_GUARD dans AppModule)
    return requiredRoles.includes(user?.role)
  }
}
```

`RolesGuard` doit s'exécuter APRÈS `JwtAuthGuard` — l'ordre de déclaration dans `providers` avec `APP_GUARD` est respecté par NestJS.

## 3. Worked examples

### Exemple A — login complet avec LocalStrategy et émission d'un JWT

```ts
// auth/auth.service.ts
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { UsersService } from '../users/users.service'
import * as bcrypt from 'bcrypt'

export interface AuthUser {
  id: number
  email: string
  role: string
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Appelé par LocalStrategy.validate() — vérifie email + mot de passe haché
  async validateUser(email: string, password: string): Promise<AuthUser> {
    // findByEmail doit sélectionner explicitement le champ password (souvent exclu par défaut)
    const user = await this.usersService.findByEmail(email)
    if (!user) throw new UnauthorizedException('Identifiants invalides')

    // bcrypt.compare est constant-time — ne jamais utiliser === sur des hashes
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) throw new UnauthorizedException('Identifiants invalides')

    // Retourner l'utilisateur sans le hash — ce sera request.user dans le handler
    return { id: user.id, email: user.email, role: user.role }
  }

  // Appelé par le handler login après que LocalStrategy a validé l'utilisateur
  async login(user: AuthUser) {
    const tokens = await this.generateTokens(user)
    // Stocker le HASH du refresh token — jamais le token brut
    const hashed = await bcrypt.hash(tokens.refreshToken, 10)
    await this.usersService.updateRefreshToken(user.id, hashed)
    return tokens
  }

  private async generateTokens(user: AuthUser) {
    const payload = { sub: user.id, email: user.email, role: user.role }
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',  // access token : durée courte
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'), // secret distinct
        expiresIn: '7d',   // refresh token : durée longue
      }),
    ])
    return { accessToken, refreshToken }
  }
}
```

```ts
// auth/auth.controller.ts (endpoints login + profile)
import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AuthService, AuthUser } from './auth.service'
import { Public } from './decorators/public.decorator'
import { CurrentUser } from './decorators/current-user.decorator'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // @Public() exempte cette route du guard JWT global enregistré dans AppModule
  // @UseGuards(AuthGuard('local')) déclenche LocalStrategy.validate()
  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@CurrentUser() user: AuthUser) {
    // user = résultat de LocalStrategy.validate() positionné dans request.user
    return this.authService.login(user)
  }

  // Protégée par le guard JWT global — aucun décorateur de guard supplémentaire
  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return user // { id, email, role } — vient de JwtStrategy.validate()
  }
}
```

```ts
// auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { AuthUser } from '../auth.service'

// Extrait request.user (positionné par la stratégie Passport) dans le paramètre du handler
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest()
    return request.user
  },
)
```

**Pas-à-pas :** (1) `@Public()` exempte `/auth/login` du guard JWT global — sans ça, le client serait bloqué avant même de se connecter ; (2) `@UseGuards(AuthGuard('local'))` déclenche `LocalStrategy.validate(email, password)` — si elle lève une exception, Passport retourne 401 automatiquement ; (3) si `validate()` réussit, `request.user` est positionné avec l'objet retourné ; (4) `@CurrentUser()` extrait `request.user` dans le paramètre `user` du handler ; (5) `authService.login(user)` signe les deux tokens avec des secrets distincts et stocke le hash du refresh token en base — jamais le token brut.

### Exemple B — guard JWT global, refresh token avec rotation, et RolesGuard TribuZen

```ts
// auth/auth.service.ts (extrait — refreshTokens et logout)
async refreshTokens(userId: number, incomingRefreshToken: string) {
  const user = await this.usersService.findByIdWithRefreshToken(userId)
  // Si pas de RT en base → session expirée ou déjà révoquée
  if (!user?.refreshToken) throw new ForbiddenException('Session expirée')

  // Comparer le token brut entrant avec le hash stocké en base
  const isValid = await bcrypt.compare(incomingRefreshToken, user.refreshToken)
  if (!isValid) throw new ForbiddenException('Refresh token invalide')

  // Rotation : générer de nouveaux tokens et invalider l'ancien en base
  const tokens = await this.generateTokens({ id: user.id, email: user.email, role: user.role })
  const hashed = await bcrypt.hash(tokens.refreshToken, 10)
  await this.usersService.updateRefreshToken(user.id, hashed)
  return tokens
}

async logout(userId: number) {
  // Supprimer le RT en base — la session est invalidée côté serveur
  await this.usersService.updateRefreshToken(userId, null)
}
```

```ts
// families/families.controller.ts — guard JWT global + RolesGuard sans décorateurs redondants
import { Controller, Get, Post, Body } from '@nestjs/common'
import { Roles } from '../auth/decorators/roles.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { FamiliesService } from './families.service'
import { AuthUser } from '../auth/auth.service'

@Controller('families')
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  // Protégée automatiquement par le guard JWT global — aucun @UseGuards ici
  @Post()
  create(@Body() dto: CreateFamilyDto, @CurrentUser() user: AuthUser) {
    // user.id vient du JWT validé — pas besoin de le passer dans le body (prévient l'usurpation)
    return this.familiesService.create(dto, user.id)
  }

  // Restreinte aux admins — RolesGuard lit @Roles() via Reflector
  @Get('admin/all')
  @Roles('admin')
  findAllAdmin() {
    return this.familiesService.findAll()
  }

  // Route publique — @Public() court-circuite le guard JWT global
  @Public()
  @Get('count')
  publicCount() {
    return this.familiesService.count()
  }
}
```

```bash
# .env — secrets générés aléatoirement, jamais commités dans Git
# Générer : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_ACCESS_SECRET=<64 caractères hexadécimaux aléatoires>
JWT_REFRESH_SECRET=<64 autres caractères hexadécimaux — différents du précédent>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

**Pas-à-pas :** (1) `POST /families` n'a aucun décorateur de guard — le guard global `APP_GUARD: JwtAuthGuard` s'applique ; (2) `JwtStrategy.validate()` décode le payload et retourne `request.user` ; (3) `@Roles('admin')` pose une métadonnée ; (4) `RolesGuard.canActivate()` lit cette métadonnée via `Reflector.getAllAndOverride` — cherche d'abord sur le handler, puis sur la classe — et compare avec `user.role` ; (5) `@Public()` fait retourner `true` immédiatement dans `JwtAuthGuard.canActivate()` — `RolesGuard` vérifie ensuite et ne trouve aucun rôle requis, donc laisse passer ; (6) la rotation du refresh token invalide l'ancien RT en base à chaque renouvellement — un RT volé est détecté lors de la tentative suivante de l'utilisateur légitime.

## 4. Pièges & misconceptions

- **JWT payload encodé, pas chiffré.** Le payload d'un JWT est encodé en Base64URL — quiconque intercepte le token peut le décoder et lire les claims. Seul l'accès à la clé `JWT_ACCESS_SECRET` permet de forger un token valide. Ne jamais stocker de mot de passe, de donnée sensible ou de secret dans le payload.

- **`ignoreExpiration: true` dans JwtStrategy.** Passer `true` accepte les tokens expirés — un access token volé reste valide indéfiniment. Toujours `ignoreExpiration: false` (c'est la valeur par défaut ; ne pas écrire l'option du tout suffit).

- **Secret JWT hardcodé dans le code.** `secretOrKey: 'monSecret'` dans la stratégie ou `JwtModule.register({ secret: 'monSecret' })` expose la clé dans l'historique Git. Toujours passer par `ConfigService` et `JwtModule.registerAsync`. Utiliser des secrets générés aléatoirement d'au moins 32 octets.

- **Refresh token stocké en clair en base.** Si la base est compromise, tous les refresh tokens sont directement utilisables. Toujours stocker `bcrypt.hash(refreshToken, 10)` et vérifier avec `bcrypt.compare()`. La valeur brute n'est jamais persistée.

- **Même secret pour access token et refresh token.** Un seul secret permet de présenter un access token à l'endpoint `/auth/refresh` (et vice versa). Deux secrets distincts (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) cloisonnent les usages.

- **`RolesGuard` sans `JwtAuthGuard` en amont.** `RolesGuard` lit `request.user` — si `JwtAuthGuard` ne s'est pas exécuté avant, `request.user` est `undefined`. La vérification `requiredRoles.includes(undefined?.role)` retourne `false` silencieusement. L'ordre des `APP_GUARD` dans `providers` est crucial : déclarer `JwtAuthGuard` avant `RolesGuard`.

- **Combiner `@Public()` et `@Roles()`.** Si `@Public()` est présent, le guard JWT ne s'exécute pas et `request.user` reste `undefined`. `RolesGuard` appellera alors `undefined?.role` — retour `false` ou exception. Ces deux décorateurs sont mutuellement exclusifs sur une même route.

- **Oublier `PassportModule` dans les imports.** Sans `PassportModule` dans `AuthModule.imports`, Passport n'est pas initialisé et `AuthGuard` lève `Error: Unknown authentication strategy "local"` ou `"jwt"`. Toujours inclure `PassportModule` même si son utilité semble implicite.

## 5. Ancrage TribuZen

Couche fil-rouge : **authentification JWT de l'API TribuZen (login parent, guard JWT, RolesGuard admin/membre)** (`smaurier/tribuzen`).

- `POST /auth/login` — un parent saisit email + password. `LocalStrategy` valide via `bcrypt.compare()`. `AuthService.login()` émet un access token (15 min, `JWT_ACCESS_SECRET`) et un refresh token (7 jours, `JWT_REFRESH_SECRET` distinct). Le hash du RT est stocké en base.
- Guard JWT global dans `AppModule` — toutes les routes `/families`, `/invitations`, `/posts` sont protégées sans décorateur redondant. `@Public()` exempte `/auth/login`, `/auth/register`, et les routes publiques de lecture.
- `@CurrentUser()` dans `FamiliesController.create()` — `user.id` extrait du JWT est lié à la famille créée sans le passer dans le body (prévient l'usurpation d'identité).
- `@Roles('admin')` sur les routes de modération — les membres `role: 'member'` reçoivent 403. Les admins gèrent suppressions, signalements et familles orphelines.
- Rotation des refresh tokens — un parent connecté depuis plusieurs semaines renouvelle via `POST /auth/refresh`. Si son RT est volé et utilisé par un attaquant, la prochaine tentative légitime échoue et force une reconnexion.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  auth/
    auth.module.ts          ← PassportModule + JwtModule.registerAsync(ConfigService)
    auth.service.ts         ← validateUser, login, refreshTokens, logout
    auth.controller.ts      ← /login, /profile, /refresh, /logout
    strategies/
      local.strategy.ts     ← LocalStrategy (usernameField: 'email')
      jwt.strategy.ts       ← JwtStrategy (ignoreExpiration: false, secretOrKey via config)
    guards/
      jwt-auth.guard.ts     ← JwtAuthGuard extends AuthGuard('jwt') + @Public() bypass
      roles.guard.ts        ← RolesGuard lit @Roles() via Reflector.getAllAndOverride
    decorators/
      current-user.decorator.ts   ← @CurrentUser() extrait request.user
      roles.decorator.ts          ← @Roles(...roles) SetMetadata(ROLES_KEY, roles)
      public.decorator.ts         ← @Public() SetMetadata(IS_PUBLIC_KEY, true)
  users/
    users.service.ts        ← findByEmail (avec password), updateRefreshToken
    users.module.ts         ← exports: [UsersService]
```

## 6. Points clés

1. `PassportStrategy(Strategy)` — classe de base à étendre. `Strategy` vient du package Passport correspondant. `validate()` retourne `request.user` ou lève une exception qui déclenche un 401 automatique.
2. `bcrypt.hash(password, 10)` à l'inscription, `bcrypt.compare(plain, hash)` au login — jamais `===` sur des hashes (pas constant-time).
3. `JwtModule.registerAsync` avec `ConfigService` — secret jamais hardcodé, toujours lu depuis les variables d'environnement.
4. `ignoreExpiration: false` dans `JwtStrategy` — valeur par défaut, ne jamais passer `true`.
5. Deux secrets distincts : `JWT_ACCESS_SECRET` (15 min) et `JWT_REFRESH_SECRET` (7 jours) — cloisonnement des usages.
6. Refresh token stocké en base sous forme de hash `bcrypt` — la valeur brute n'est jamais persistée.
7. Rotation obligatoire : à chaque refresh, nouveau RT émis et ancien invalidé en base — détection de vol côté utilisateur légitime.
8. Guard JWT global via `APP_GUARD` dans `AppModule` — toutes les routes protégées par défaut, `@Public()` pour les exemptions.
9. `RolesGuard` déclaré après `JwtAuthGuard` dans `providers` — l'ordre `APP_GUARD` est garanti par NestJS.
10. `Reflector.getAllAndOverride` — cherche la métadonnée d'abord sur le handler, puis sur la classe controller.

## 7. Seeds Anki

```
Quel est le rôle de PassportStrategy(Strategy) dans NestJS ?|Classe de base à étendre pour créer une stratégie Passport. Strategy vient du package passport-* correspondant. validate() retourne request.user ou lève une exception pour un refus 401 automatique.
Pourquoi bcrypt.compare() plutôt que === pour vérifier un mot de passe ?|bcrypt.compare est constant-time (résistant aux attaques par timing) — === court-circuite dès la première différence et peut leaker des informations sur la longueur du hash.
Comment injecter le secret JWT depuis ConfigService sans le hardcoder ?|JwtModule.registerAsync avec inject: [ConfigService] et useFactory qui lit config.get('JWT_ACCESS_SECRET') — jamais JwtModule.register({ secret: 'monSecret' }).
Que se passe-t-il si ignoreExpiration: true dans JwtStrategy ?|Les tokens JWT expirés sont acceptés — un access token volé reste valide indéfiniment. Toujours false (valeur par défaut ; omettre l'option suffit).
Pourquoi deux secrets distincts pour access token et refresh token ?|Un seul secret permettrait de présenter un access token à l'endpoint refresh (et vice versa). Deux secrets cloisonnent les usages — compromettre l'un ne compromet pas l'autre.
Comment stocker un refresh token en base de façon sécurisée ?|Stocker bcrypt.hash(refreshToken, 10) — jamais le token brut. En cas de fuite de la base, les tokens restent inutilisables sans la valeur brute originale.
Qu'est-ce que la rotation des refresh tokens ?|À chaque refresh, un nouveau RT est émis et l'ancien est invalidé en base. Si un attaquant utilise un RT volé avant l'utilisateur légitime, ce dernier détectera l'invalidation à son prochain refresh.
Comment protéger toutes les routes sans décorer chaque controller ?|Enregistrer JwtAuthGuard via APP_GUARD dans AppModule — { provide: APP_GUARD, useClass: JwtAuthGuard }. Exempter les routes publiques avec @Public() qui court-circuite canActivate.
Comment RolesGuard obtient-il les rôles requis d'une route ?|Via Reflector.getAllAndOverride(ROLES_KEY, [context.getHandler(), context.getClass()]) — cherche d'abord sur le handler, puis sur la classe controller.
Pourquoi combiner @Public() et @Roles() sur une même route est-il une erreur ?|@Public() court-circuite JwtAuthGuard, donc request.user reste undefined. RolesGuard cherche user.role mais user n'existe pas — résultat imprévisible.
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-19-auth-nestjs/README.md`. Tu y implémentes l'authentification JWT complète de TribuZen — login `LocalStrategy`, guard JWT global, refresh token avec rotation, `RolesGuard` admin/membre. Corrigé complet commenté + variante J+30 dans le README du lab.
