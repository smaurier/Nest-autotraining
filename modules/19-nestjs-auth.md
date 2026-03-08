# Module 19 — NestJS — Authentification & Autorisation

> **Objectif** : Implementer un systeme complet d'authentification JWT avec refresh tokens, et un systeme d'autorisation base sur les roles (RBAC) dans une application NestJS.
> **Difficulte** : ⭐⭐⭐⭐ (avance+)
> **Prerequis** : Module 13 (Guards, Decorateurs), Module 14 ou 16 (ORM), Module 18 (Testing)
> **Duree estimee** : 7 heures

---

## 1. Concepts fondamentaux

### 1.1 Authentification vs Autorisation

| Concept | Question | Exemple |
|---------|----------|---------|
| **Authentification** | "Qui etes-vous ?" | Verifier email + mot de passe |
| **Autorisation** | "Avez-vous le droit ?" | Verifier si l'utilisateur est admin |

> **Analogie** : L'authentification c'est montrer votre carte d'identite a l'entree d'un immeuble (prouver qui vous etes). L'autorisation c'est verifier que votre badge donne acces a l'etage 5 (verifier vos droits).

### 1.2 Qu'est-ce qu'un JWT ?

Un **JSON Web Token** (JWT) est un token auto-portant compose de trois parties :

```
Header.Payload.Signature

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.          ← Header (algorithme)
eyJzdWIiOjEsImVtYWlsIjoiYWxpY2VAZXhhbXBsZS5jb20ifQ. ← Payload (donnees)
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c    ← Signature (verification)
```

| Partie | Contenu | Exemple |
|--------|---------|---------|
| Header | Algorithme + type | `{ "alg": "HS256", "typ": "JWT" }` |
| Payload | Donnees utilisateur (claims) | `{ "sub": 1, "email": "alice@example.com", "roles": ["admin"] }` |
| Signature | Verification d'integrite | HMAC-SHA256(header + payload, secret) |

> **Piege classique** : Le payload d'un JWT est **encode en Base64**, pas **chiffre**. N'importe qui peut le decoder et lire son contenu. Ne mettez jamais d'informations sensibles (mot de passe, numero de carte) dans le payload.

### 1.3 Flux d'authentification JWT

```
1. Client → POST /auth/login { email, motDePasse }
2. Serveur : verifie les identifiants
3. Serveur → { accessToken: "eyJ...", refreshToken: "eyJ..." }
4. Client stocke les tokens
5. Client → GET /users (Authorization: Bearer eyJ...)
6. Serveur : verifie le JWT, identifie l'utilisateur
7. Serveur → { data: [...] }
```

---

## 2. Installation et configuration

### 2.1 Packages necessaires

```bash
npm install @nestjs/passport passport passport-local passport-jwt
npm install @nestjs/jwt
npm install bcrypt
npm install --save-dev @types/passport-local @types/passport-jwt @types/bcrypt
```

| Package | Role |
|---------|------|
| `@nestjs/passport` | Integration Passport.js avec NestJS |
| `passport` | Framework d'authentification pour Node.js |
| `passport-local` | Strategie email/mot de passe |
| `passport-jwt` | Strategie JWT |
| `@nestjs/jwt` | Service JWT pour NestJS |
| `bcrypt` | Hachage de mots de passe |

### 2.2 Structure du module auth

```
src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── local.strategy.ts
│   │   └── jwt.strategy.ts
│   ├── guards/
│   │   ├── local-auth.guard.ts
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── public.decorator.ts
│   └── dto/
│       ├── login.dto.ts
│       ├── register.dto.ts
│       └── tokens.dto.ts
├── users/
│   ├── entities/user.entity.ts
│   ├── users.service.ts
│   └── users.module.ts
```

---

## 3. L'entite User avec mot de passe hache

```typescript
// users/entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import * as bcrypt from 'bcrypt';

export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nom: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false }) // Ne PAS inclure par defaut dans les requetes
  motDePasse: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ default: true })
  actif: boolean;

  @Column({ nullable: true, select: false })
  refreshToken: string | null; // Hash du refresh token

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Hook avant insertion : hasher le mot de passe
  @BeforeInsert()
  async hashPassword() {
    if (this.motDePasse) {
      this.motDePasse = await bcrypt.hash(this.motDePasse, 10);
    }
  }

  // Methode utilitaire pour verifier le mot de passe
  async verifierMotDePasse(motDePasse: string): Promise<boolean> {
    return bcrypt.compare(motDePasse, this.motDePasse);
  }
}
```

---

## 4. Le UsersService

```typescript
// users/users.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(data: {
    nom: string;
    email: string;
    motDePasse: string;
    role?: UserRole;
  }): Promise<User> {
    // Verifier l'unicite de l'email
    const existing = await this.userRepo.findOneBy({ email: data.email });
    if (existing) {
      throw new ConflictException('Cet email est deja utilise');
    }

    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    // On selectionne explicitement le mot de passe (exclu par defaut)
    return this.userRepo.findOne({
      where: { email },
      select: ['id', 'email', 'nom', 'motDePasse', 'role', 'actif'],
    });
  }

  async findById(id: number): Promise<User> {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`Utilisateur #${id} introuvable`);
    }
    return user;
  }

  async updateRefreshToken(userId: number, refreshToken: string | null): Promise<void> {
    // Stocker le HASH du refresh token (pas le token en clair)
    const hashedToken = refreshToken
      ? await bcrypt.hash(refreshToken, 10)
      : null;

    await this.userRepo.update(userId, { refreshToken: hashedToken });
  }

  async findByIdWithRefreshToken(id: number): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      select: ['id', 'email', 'nom', 'role', 'refreshToken'],
    });
  }
}
```

---

## 5. Le AuthService — Logique d'authentification

```typescript
// auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

// Interface du payload JWT
export interface JwtPayload {
  sub: number;    // ID de l'utilisateur
  email: string;
  role: string;
}

// Interface des tokens retournes
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // Valider les identifiants (utilise par LocalStrategy)
  async validateUser(email: string, motDePasse: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (!user.actif) {
      throw new UnauthorizedException('Compte desactive');
    }

    const motDePasseValide = await bcrypt.compare(motDePasse, user.motDePasse);
    if (!motDePasseValide) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Retourner l'utilisateur SANS le mot de passe
    const { motDePasse: _, ...result } = user;
    return result;
  }

  // Generer les tokens (access + refresh)
  async login(user: any): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = await this.generateTokens(payload);

    // Stocker le hash du refresh token en base
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  // Inscription
  async register(data: {
    nom: string;
    email: string;
    motDePasse: string;
  }): Promise<AuthTokens> {
    const user = await this.usersService.create(data);
    return this.login(user);
  }

  // Rafraichir les tokens
  async refreshTokens(userId: number, refreshToken: string): Promise<AuthTokens> {
    const user = await this.usersService.findByIdWithRefreshToken(userId);

    if (!user || !user.refreshToken) {
      throw new ForbiddenException('Acces refuse');
    }

    // Verifier le refresh token
    const tokenValide = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!tokenValide) {
      throw new ForbiddenException('Refresh token invalide');
    }

    // Generer de nouveaux tokens (rotation)
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = await this.generateTokens(payload);

    // Mettre a jour le refresh token en base
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  // Deconnexion
  async logout(userId: number): Promise<void> {
    // Supprimer le refresh token en base
    await this.usersService.updateRefreshToken(userId, null);
  }

  // Generer les deux tokens
  private async generateTokens(payload: JwtPayload): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      // Access token : courte duree (15 minutes)
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
      }),
      // Refresh token : longue duree (7 jours)
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
```

> **Bonne pratique** : Utilisez deux secrets differents pour l'access token et le refresh token. Si l'access token est compromis, le refresh token reste securise et vice versa.

---

## 6. Les Strategies Passport

### 6.1 LocalStrategy — Login par email/mot de passe

```typescript
// auth/strategies/local.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',      // Par defaut, Passport cherche 'username'
      passwordField: 'motDePasse',  // Par defaut, Passport cherche 'password'
    });
  }

  // Cette methode est appelee automatiquement par Passport
  // Si elle retourne un objet, il sera attache a request.user
  // Si elle lance une exception, la requete est refusee
  async validate(email: string, motDePasse: string): Promise<any> {
    const user = await this.authService.validateUser(email, motDePasse);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user; // → request.user = user
  }
}
```

### 6.2 JwtStrategy — Verification du token JWT

```typescript
// auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      // Ou extraire le JWT : depuis le header Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Ne pas accepter les tokens expires
      ignoreExpiration: false,
      // Secret pour verifier la signature
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  // Appelee APRES que Passport a verifie la signature et l'expiration
  // Le payload est le contenu decode du JWT
  async validate(payload: JwtPayload): Promise<any> {
    // Optionnel : verifier que l'utilisateur existe toujours en base
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.actif) {
      throw new UnauthorizedException('Utilisateur inactif ou supprime');
    }

    // Ce qui est retourne ici sera disponible dans request.user
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
```

### 6.3 JwtRefreshStrategy — Pour le refresh token

```typescript
// auth/strategies/jwt-refresh.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true, // Passe la requete au callback validate
    });
  }

  // On passe aussi la requete pour recuperer le refresh token brut
  validate(req: Request, payload: any) {
    const refreshToken = req.headers.authorization?.split(' ')[1];
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      refreshToken,
    };
  }
}
```

---

## 7. Les Guards

```typescript
// auth/guards/local-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Guard pour la strategie locale (login)
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
```

```typescript
// auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Verifier si la route est marquee comme publique
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Sinon, verifier le JWT
    return super.canActivate(context);
  }
}
```

```typescript
// auth/guards/jwt-refresh.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
```

```typescript
// auth/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Pas de roles requis → acces libre
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Aucun utilisateur dans la requete');
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Role "${user.role}" insuffisant. Roles requis : ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
```

---

## 8. Les decorateurs personnalises

```typescript
// auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marque une route comme accessible sans authentification
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Definit les roles necessaires pour acceder a une route
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Decorateur pour recuperer l'utilisateur connecte
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Si un champ specifique est demande
    if (data) {
      return user?.[data];
    }

    return user;
  },
);
```

Utilisation :

```typescript
@Get('me')
getProfile(@CurrentUser() user: any) {
  // user = { id: 1, email: 'alice@test.com', role: 'admin' }
  return user;
}

@Get('my-id')
getMyId(@CurrentUser('id') userId: number) {
  // userId = 1
  return { userId };
}
```

---

## 9. Le AuthController

```typescript
// auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // === INSCRIPTION ===
  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // === CONNEXION ===
  @Public()
  @UseGuards(LocalAuthGuard) // Utilise la strategie locale
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@CurrentUser() user: any) {
    // LocalAuthGuard a deja verifie les identifiants
    // user est le resultat de LocalStrategy.validate()
    return this.authService.login(user);
  }

  // === RAFRAICHISSEMENT DU TOKEN ===
  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@CurrentUser() user: any) {
    return this.authService.refreshTokens(user.id, user.refreshToken);
  }

  // === DECONNEXION ===
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('id') userId: number) {
    await this.authService.logout(userId);
    return { message: 'Deconnexion reussie' };
  }
}
```

---

## 10. Le AuthModule

```typescript
// auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
```

### Configuration globale dans AppModule

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    // ... autres modules
  ],
  providers: [
    // Guard JWT global : toutes les routes sont protegees par defaut
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Guard de roles global
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
```

> **A retenir** : Avec `APP_GUARD`, toutes les routes sont protegees par defaut. Utilisez le decorateur `@Public()` pour rendre une route accessible sans authentification (login, register, pages publiques).

---

## 11. Les DTOs

```typescript
// auth/dto/register.dto.ts
import { IsString, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nom: string;

  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caracteres' })
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir une majuscule, une minuscule et un chiffre',
  })
  motDePasse: string;
}
```

```typescript
// auth/dto/login.dto.ts
import { IsString, IsEmail } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  motDePasse: string;
}
```

---

## 12. Le flux de refresh token

Le refresh token permet de prolonger la session sans re-demander les identifiants.

```
1. Login → accessToken (15min) + refreshToken (7j)
2. ... utilisation normale avec accessToken ...
3. accessToken expire (401)
4. Client → POST /auth/refresh (Authorization: Bearer <refreshToken>)
5. Serveur → nouveau accessToken + nouveau refreshToken (ROTATION)
6. L'ancien refreshToken est invalide
```

> **Bonne pratique** : La **rotation des refresh tokens** signifie qu'a chaque utilisation, un nouveau refresh token est genere et l'ancien est invalide. Si un attaquant vole un refresh token et l'utilise, le vrai utilisateur recevra une erreur au prochain refresh, signalant une compromission.

---

## 13. Variables d'environnement

```env
# .env
JWT_ACCESS_SECRET=monSuperSecretAccessTokenQuiEstTresLong123!
JWT_REFRESH_SECRET=monSuperSecretRefreshTokenDifferentDuPremier456!
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

> **Piege classique** : Utilisez des secrets longs et aleatoires (au moins 32 caracteres). Ne reutilisez jamais le meme secret pour l'access token et le refresh token. Ne commitez jamais le fichier `.env` dans Git.

---

## 14. Hachage des mots de passe avec bcrypt

```typescript
import * as bcrypt from 'bcrypt';

// Hacher un mot de passe
const motDePasse = 'MonMotDePasse123!';
const salt = 10; // Nombre de rounds (plus c'est eleve, plus c'est lent et securise)
const hash = await bcrypt.hash(motDePasse, salt);
// → '$2b$10$X3z9y8w7v6u5t4s3r2q1p.abc123...'

// Verifier un mot de passe
const isValid = await bcrypt.compare('MonMotDePasse123!', hash);
// → true

const isInvalid = await bcrypt.compare('MauvaisMotDePasse', hash);
// → false
```

| Salt rounds | Temps approximatif | Usage |
|-------------|-------------------|-------|
| 8 | ~40ms | Tests, dev |
| 10 | ~100ms | Production (recommande) |
| 12 | ~300ms | Securite renforcee |
| 14 | ~1s | Tres haute securite |

---

## 15. Utilisation dans les controllers

```typescript
// products/products.controller.ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('products')
export class ProductsController {
  // Route publique — pas d'authentification requise
  @Public()
  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  // Route protegee (tous les utilisateurs authentifies)
  @Get('favorites')
  getFavorites(@CurrentUser('id') userId: number) {
    return this.productsService.getFavorites(userId);
  }

  // Route restreinte aux admins
  @Post()
  @Roles('admin')
  create(@Body() dto: CreateProductDto, @CurrentUser() user: any) {
    return this.productsService.create(dto, user.id);
  }

  // Route restreinte aux admins et moderateurs
  @Post(':id/approve')
  @Roles('admin', 'moderator')
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.approve(id);
  }
}
```

---

## 16. Securite — Bonnes pratiques

| Pratique | Description |
|----------|-------------|
| Secrets forts | Utilisez des cles de 256+ bits pour les secrets JWT |
| Duree courte pour access token | 15 minutes maximum |
| Rotation des refresh tokens | Nouveau refresh token a chaque utilisation |
| Hashage bcrypt | Ne stockez JAMAIS les mots de passe en clair |
| HTTPS obligatoire | Les JWT transitent en clair dans les headers |
| Rate limiting | Limitez les tentatives de login (voir Module 23) |
| Validation des entrees | Utilisez le ValidationPipe sur tous les DTOs |
| Ne pas exposer le mot de passe | `select: false` dans l'entite |
| CORS configure | Ne pas accepter toutes les origines |
| Helmet | Ajouter les headers de securite HTTP |

```bash
# Installer helmet pour les headers de securite
npm install helmet
```

```typescript
// main.ts
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  // ...
}
```

---

## 17. Exercices pratiques

### Exercice 1 : Implementation complete

Implementez le systeme d'authentification complet decrit dans ce module avec : inscription, connexion, refresh, deconnexion.

### Exercice 2 : RBAC avance

Ajoutez un systeme de permissions granulaires : au lieu de simples roles, definissez des permissions (`create:article`, `delete:article`, `manage:users`) et un guard qui les verifie.

### Exercice 3 : Tests

Ecrivez les tests unitaires pour `AuthService` et les tests E2E pour les endpoints d'authentification.

---

## Liens

| Ressource | Lien |
|-----------|------|
| Quiz Module 19 | `quiz/19-quiz.md` |
| Lab Module 19 | `labs/19-lab-auth.md` |
| Screencast | `screencasts/19-screencast.md` |
| Module precedent | [Module 18 — Testing](18-nestjs-testing.md) |
| Module suivant | [Module 20 — Configuration & Swagger](20-nestjs-config-swagger.md) |
| NestJS Authentication | https://docs.nestjs.com/security/authentication |
| NestJS Authorization | https://docs.nestjs.com/security/authorization |
| Passport.js | https://www.passportjs.org/ |
| JWT.io | https://jwt.io/ |
| bcrypt | https://github.com/kelektiv/node.bcrypt.js |
