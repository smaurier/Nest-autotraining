# Screencast 19 — Auth NestJS

## Informations
- **Duree estimee** : 20-25 min
- **Module** : `modules/19-nestjs-auth.md`
- **Lab associe** : `labs/lab-19-auth-nestjs/`
- **Prérequis** : Screencast 18 (Testing NestJS), Screencast 08 (Auth & Sécurité)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Projet NestJS avec Prisma configure
- [ ] Editeur de code ouvert
- [ ] Port 3000 disponible

## Script

### [00:00-03:00] Introduction — Auth professionnelle avec Passport

> Salut ! Au screencast 08, on a implemente l'auth manuellement avec Express. Maintenant on va le faire dans les regles de l'art avec NestJS, Passport, et les Guards. C'est l'approche recommandee pour la production.

**Action** : Afficher le slide de titre "Module 19 — Auth NestJS".

> Passport est la librairie d'authentification la plus utilisee dans l'ecosysteme Node.js. Elle supporte plus de 500 stratégies : JWT, OAuth, Google, GitHub, etc. NestJS l'intégré parfaitement via `@nestjs/passport`.

**Action** : Installer les dépendances.

```bash
npm install @nestjs/passport passport @nestjs/jwt passport-jwt passport-local bcryptjs
npm install -D @types/passport-jwt @types/passport-local @types/bcryptjs
```

### [03:00-08:00] Strategy Local — Login avec email/password

**Action** : Créer le module auth.

```bash
nest g module auth
nest g service auth
nest g controller auth
```

**Action** : Implementer le service auth.

```typescript
// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;

    const { password: _, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async register(data: { name: string; email: string; password: string }) {
    const hash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: { ...data, password: hash },
    });
    const { password: _, ...result } = user;
    return result;
  }
}
```

**Action** : Créer la strategy locale.

```typescript
// src/auth/strategies/local.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string) {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    return user;
  }
}
```

### [08:00-13:00] Strategy JWT — Proteger les routes

**Action** : Créer la strategy JWT.

```typescript
// src/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
    });
  }

  async validate(payload: any) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
```

**Action** : Configurer le module auth.

```typescript
// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

**Action** : Créer les guards et le controller.

```typescript
// src/auth/guards/local-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}

// src/auth/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

```typescript
// src/auth/auth.controller.ts
import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() body: { name: string; email: string; password: string }) {
    return this.authService.register(body);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
}
```

**Action** : Tester le flux complet.

```bash
# Register
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@nest.com","password":"motdepasse123"}' \
  http://localhost:3000/auth/register

# Login
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"alice@nest.com","password":"motdepasse123"}' \
  http://localhost:3000/auth/login

# Profile (avec le token)
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/auth/profile
```

### [13:00-18:00] RBAC — Role-Based Access Control

> On va ajouter le controle d'acces base sur les roles.

**Action** : Créer le decorateur et le guard de roles.

```typescript
// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
```

```typescript
// src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
```

**Action** : Appliquer les roles sur les routes.

```typescript
// src/tasks/tasks.controller.ts
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser('id') userId: number) {
    return this.tasksService.create(dto, userId);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.remove(id);
  }
}
```

> Le decorateur `@CurrentUser` extrait l'utilisateur du token JWT. `@Roles('admin')` restreint l'acces aux administrateurs. Le RolesGuard vérifié le role et renvoie un 403 Forbidden si nécessaire.

### [18:00-22:00] Decorateur Public et Guard global

**Action** : Configurer le JwtAuthGuard comme guard global.

```typescript
// src/auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// src/auth/guards/jwt-auth.guard.ts (mise a jour)
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

> Avec le guard global, toutes les routes sont protegees par defaut. On utilise `@Public()` pour marquer les routes publiques. C'est plus sécurisé que l'inverse.

### [22:00-24:00] Recap

> On a implemente un système d'auth complet : Passport avec stratégies Local et JWT, guards pour proteger les routes, RBAC pour le controle d'acces, decorateur @CurrentUser pour acceder a l'utilisateur courant, et guard global avec exemption @Public.

**Action** : Afficher le slide recap.

> Le lab est dans `labs/lab-19-auth-nestjs/`. Implementez le flux complet et testez chaque scenario. A bientot pour la configuration et Swagger !

## Points d'attention pour l'enregistrement
- Bien montrer le flux complet : register -> login -> profil avec token
- Copier-coller le token depuis la réponse login, ne pas le taper à la main
- Tester le cas 403 Forbidden avec un utilisateur non-admin
- Le JWT_SECRET doit venir d'une variable d'environnement, le rappeler
