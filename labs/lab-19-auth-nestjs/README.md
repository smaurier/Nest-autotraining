# Lab 19 — NestJS auth

> **Outcome :** à la fin, tu sais implémenter un login Passport/JWT, protéger toutes les routes avec un guard global, gérer la rotation des refresh tokens avec stockage haché, et autoriser par rôle avec un `RolesGuard` dans NestJS 11.
> **Vrai outil :** NestJS 11 (`@nestjs/passport ^11`, `@nestjs/jwt ^11`, `passport-local ^1`, `passport-jwt ^4`, `bcrypt`).
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu implémentes la couche auth de l'API TribuZen dans le projet NestJS existant `lab-19-auth-nestjs`. Les stubs de fichiers sont en place — tu écris l'implémentation de A à Z.

Objectif fonctionnel :

- `POST /auth/login` → valide email + password, retourne `{ accessToken, refreshToken }`
- `POST /auth/refresh` → échange `{ userId, refreshToken }` contre de nouveaux tokens (rotation)
- `POST /auth/logout` → invalide le refresh token en base
- `GET /auth/profile` → retourne l'utilisateur courant — protégé par le guard JWT global
- `GET /families` → protégé par le guard JWT global sans aucun `@UseGuards` dans le controller
- `GET /families/admin` → restreint au rôle `admin` via `@Roles('admin')` + `RolesGuard`

## Étapes (en friction)

1. **UsersService** (`src/users/users.service.ts`) — store en mémoire. Implémenter `create(email, password, role)` qui hash le password avec `bcrypt.hash(password, 10)` avant de stocker. Implémenter `findByEmail(email)` qui retourne l'utilisateur avec le champ `password` (hash). Implémenter `updateRefreshToken(userId, hashedToken | null)` pour stocker ou effacer le hash du RT.

2. **AuthService.validateUser** (`src/auth/auth.service.ts`) — charger l'utilisateur via `findByEmail`, appeler `bcrypt.compare(password, user.password)` (pas `===`), lever `UnauthorizedException` si invalide, retourner `{ id, email, role }` sans le hash.

3. **AuthService.login + generateTokens** — dans `login(user)`, générer access token (`JWT_ACCESS_SECRET`, `15m`) et refresh token (`JWT_REFRESH_SECRET`, `7d`) via `jwtService.signAsync` avec deux appels `Promise.all`. Stocker `bcrypt.hash(refreshToken, 10)` en base — pas le RT brut.

4. **LocalStrategy** (`src/auth/strategies/local.strategy.ts`) — étendre `PassportStrategy(Strategy)` de `passport-local`. Dans `super()`, passer `{ usernameField: 'email', passwordField: 'password' }`. Appeler `authService.validateUser` dans `validate()` — retourner le résultat.

5. **JwtStrategy** (`src/auth/strategies/jwt.strategy.ts`) — étendre `PassportStrategy(Strategy)` de `passport-jwt`. Configurer `jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()`, `ignoreExpiration: false` (ne jamais passer `true`), `secretOrKey: config.get('JWT_ACCESS_SECRET')`. `validate(payload)` retourne `{ id: payload.sub, email, role }`.

6. **JwtAuthGuard global** (`src/auth/guards/jwt-auth.guard.ts`) — étendre `AuthGuard('jwt')`, injecter `Reflector`. Dans `canActivate`, lire `IS_PUBLIC_KEY` via `reflector.getAllAndOverride([handler, class])` — retourner `true` si `isPublic`. Enregistrer dans `AppModule` via `{ provide: APP_GUARD, useClass: JwtAuthGuard }`. Vérifier que `GET /families` retourne 401 sans JWT sans aucun décorateur dans `FamiliesController`.

7. **AuthService.refreshTokens** — charger le hash RT en base, appeler `bcrypt.compare(incomingRT, storedHash)`, lever `ForbiddenException` si invalide, générer de nouveaux tokens, stocker le nouveau hash (rotation complète), retourner les tokens.

8. **RolesGuard** (`src/auth/guards/roles.guard.ts`) — implémenter `CanActivate`. Lire `ROLES_KEY` via `Reflector.getAllAndOverride`. Retourner `true` si aucun rôle requis. Sinon, lire `request.user.role` (positionné par `JwtAuthGuard` en amont) et vérifier `requiredRoles.includes(user.role)`. Enregistrer dans `AppModule` après `JwtAuthGuard`.

## Corrigé complet commenté

```ts
// src/users/users.service.ts
import { Injectable, ConflictException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'

export interface User {
  id: number
  email: string
  password: string           // hash bcrypt — jamais le mot de passe en clair
  role: 'admin' | 'member'
  refreshToken: string | null // hash bcrypt du RT — jamais le RT brut
}

@Injectable()
export class UsersService {
  private users: User[] = []
  private nextId = 1

  async create(email: string, password: string, role: 'admin' | 'member' = 'member'): Promise<User> {
    if (this.users.find(u => u.email === email)) {
      throw new ConflictException('Email déjà utilisé')
    }
    // cost factor 10 ≈ 100 ms — délibérément lent pour résister aux attaques par bruteforce
    const hashed = await bcrypt.hash(password, 10)
    const user: User = { id: this.nextId++, email, password: hashed, role, refreshToken: null }
    this.users.push(user)
    return user
  }

  findByEmail(email: string): User | undefined {
    return this.users.find(u => u.email === email)
    // Retourne le champ password (hash) — nécessaire pour bcrypt.compare au login
  }

  findById(id: number): User | undefined {
    return this.users.find(u => u.id === id)
  }

  updateRefreshToken(userId: number, hashedToken: string | null): void {
    const user = this.users.find(u => u.id === userId)
    if (user) user.refreshToken = hashedToken
    // null → RT effacé — la session est invalide côté serveur (logout)
  }
}
```

```ts
// src/auth/auth.service.ts
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
    const user = this.usersService.findByEmail(email)
    if (!user) throw new UnauthorizedException('Identifiants invalides')

    // bcrypt.compare est constant-time — ne jamais utiliser === sur des hashes
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) throw new UnauthorizedException('Identifiants invalides')

    return { id: user.id, email: user.email, role: user.role }
  }

  async login(user: AuthUser) {
    const tokens = await this.generateTokens(user)
    // Stocker le HASH du refresh token — jamais le token brut
    const hashed = await bcrypt.hash(tokens.refreshToken, 10)
    this.usersService.updateRefreshToken(user.id, hashed)
    return tokens
  }

  async refreshTokens(userId: number, incomingRefreshToken: string) {
    const user = this.usersService.findById(userId)
    // Si pas de RT en base → session expirée ou logout déjà effectué
    if (!user?.refreshToken) throw new ForbiddenException('Session expirée')

    // Comparer le RT entrant (brut) avec le hash stocké
    const isValid = await bcrypt.compare(incomingRefreshToken, user.refreshToken)
    if (!isValid) throw new ForbiddenException('Refresh token invalide')

    // Rotation : nouveau RT émis, ancien invalidé en base
    const tokens = await this.generateTokens({ id: user.id, email: user.email, role: user.role })
    const hashed = await bcrypt.hash(tokens.refreshToken, 10)
    this.usersService.updateRefreshToken(user.id, hashed)
    return tokens
  }

  async logout(userId: number): Promise<void> {
    // null → RT effacé en base — sessions futures invalides
    this.usersService.updateRefreshToken(userId, null)
  }

  private async generateTokens(user: AuthUser) {
    const payload = { sub: user.id, email: user.email, role: user.role }
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',   // access token : durée courte
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'), // secret distinct — cloisonnement
        expiresIn: '7d',    // refresh token : durée longue
      }),
    ])
    return { accessToken, refreshToken }
  }
}
```

```ts
// src/auth/strategies/local.strategy.ts
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

  async validate(email: string, password: string) {
    // Passport extrait les champs du body et appelle validate() automatiquement
    const user = await this.authService.validateUser(email, password)
    if (!user) throw new UnauthorizedException()
    return user // → request.user dans le handler login
  }
}
```

```ts
// src/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // ⚠️ tokens expirés refusés — ne jamais passer true
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'), // lu depuis ConfigService
    })
  }

  // Appelé APRÈS vérification signature + expiration par Passport
  async validate(payload: { sub: number; email: string; role: string }) {
    return { id: payload.sub, email: payload.email, role: payload.role }
    // → request.user dans tous les handlers protégés
  }
}
```

```ts
// src/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Reflector } from '@nestjs/core'

export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => {
  // Inline pour le corrigé — en pratique, importer depuis decorators/public.decorator.ts
  const { SetMetadata } = require('@nestjs/common')
  return SetMetadata(IS_PUBLIC_KEY, true)
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) { super() }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true         // @Public() → pas de vérification JWT
    return super.canActivate(context) // déclenche JwtStrategy.validate()
  }
}
```

```ts
// src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

export const ROLES_KEY = 'roles'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    // Pas de @Roles() sur la route → tout utilisateur authentifié est autorisé
    if (!requiredRoles?.length) return true

    const { user } = context.switchToHttp().getRequest()
    // user positionné par JwtAuthGuard (déclaré avant dans APP_GUARD)
    return requiredRoles.includes(user?.role)
  }
}
```

```ts
// src/auth/auth.controller.ts
import {
  Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common'
import { AuthService, AuthUser } from './auth.service'
import { IS_PUBLIC_KEY } from './guards/jwt-auth.guard'
import { ROLES_KEY } from './guards/roles.guard'

// En pratique, ces décorateurs sont dans des fichiers séparés dans decorators/
const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)
const GetUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
)

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // @Public() exempte du guard JWT global — sinon le client serait bloqué avant de se connecter
  @Public()
  @UseGuards(AuthGuard('local')) // déclenche LocalStrategy.validate(email, password)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@GetUser() user: AuthUser) {
    return this.authService.login(user) // user = résultat de LocalStrategy.validate()
  }

  // Refresh : @Public() + RT en body — approche simplifiée (J+30 : JwtRefreshStrategy)
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: { userId: number; refreshToken: string }) {
    return this.authService.refreshTokens(body.userId, body.refreshToken)
  }

  // Protégé par le guard JWT global — aucun @UseGuards supplémentaire
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@GetUser() user: AuthUser) {
    await this.authService.logout(user.id)
    return { message: 'Déconnecté' }
  }

  // Protégé par le guard JWT global
  @Get('profile')
  profile(@GetUser() user: AuthUser) {
    return user // { id, email, role } — vient de JwtStrategy.validate()
  }
}
```

```ts
// src/app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { AuthModule } from './auth/auth.module'
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard'
import { RolesGuard } from './auth/guards/roles.guard'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
  ],
  providers: [
    // Ordre important : JwtAuthGuard s'exécute en premier et positionne request.user
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // RolesGuard s'exécute ensuite et lit request.user.role
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

```ts
// src/auth/auth.module.ts
import { Module } from '@nestjs/common'
import { PassportModule } from '@nestjs/passport'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { LocalStrategy } from './strategies/local.strategy'
import { JwtStrategy } from './strategies/jwt.strategy'
import { UsersModule } from '../users/users.module'

@Module({
  imports: [
    UsersModule,
    PassportModule,                 // obligatoire — initialise Passport.js
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Secret lu depuis ConfigService — jamais hardcodé
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

```bash
# .env — ne jamais committer dans Git
# Générer un secret : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_ACCESS_SECRET=remplacer_par_64_caracteres_aleatoires
JWT_REFRESH_SECRET=remplacer_par_64_autres_caracteres_differents
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

## Variante J+30 (fading)

Même exercice, sans consulter le corrigé. Contraintes supplémentaires :

1. Créer un décorateur `@CurrentUser(field?)` dans `decorators/current-user.decorator.ts` — `@CurrentUser('id')` retourne `user.id`, `@CurrentUser()` retourne tout l'objet. Remplacer `GetUser` inline par ce décorateur dans le controller.

2. Implémenter une `JwtRefreshStrategy` séparée (nom `'jwt-refresh'`, `secretOrKey: JWT_REFRESH_SECRET`, `passReqToCallback: true`) et un `JwtRefreshGuard` correspondant. L'endpoint `POST /auth/refresh` utilise ce guard plutôt que de recevoir `userId` dans le body — le `userId` et le RT sont extraits du token décodé et de la requête.

3. Ajouter `helmet` dans `main.ts` (`app.use(helmet())`) et un `ValidationPipe` global (`app.useGlobalPipes(new ValidationPipe({ whitelist: true }))`). Créer un `LoginDto` avec `@IsEmail()` et `@IsString()` pour valider le body du login. Documenter en commentaire pourquoi `helmet` ne remplace pas le HTTPS obligatoire pour les JWT en transit.

Temps cible : 45 minutes sans le corrigé.

## Application TribuZen

Commit cible dans `smaurier/tribuzen` :

```
feat(auth): login JWT + guard global + RolesGuard admin/membre
```

Fichiers à créer :

- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/strategies/local.strategy.ts`
- `apps/api/src/auth/strategies/jwt.strategy.ts`
- `apps/api/src/auth/guards/jwt-auth.guard.ts`
- `apps/api/src/auth/guards/roles.guard.ts`
- `apps/api/src/auth/decorators/current-user.decorator.ts`
- `apps/api/src/auth/decorators/roles.decorator.ts`
- `apps/api/src/auth/decorators/public.decorator.ts`
- `apps/api/src/users/users.service.ts`
- `apps/api/src/users/users.module.ts`

Critère de done : `POST /auth/login` avec un parent enregistré retourne `{ accessToken, refreshToken }`. `GET /families` sans header JWT retourne 401. `GET /families/admin` avec un token `role: 'member'` retourne 403.
