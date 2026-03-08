# Screencast 13 — Pipes, Guards & Interceptors

## Informations
- **Duree estimee** : 18-22 min
- **Module** : `modules/13-nestjs-pipes-guards-interceptors.md`
- **Lab associe** : `labs/lab-13-pipes-guards/`
- **Prerequis** : Screencast 12 (Modules & Architecture)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Projet NestJS du screencast precedent disponible
- [ ] Editeur de code ouvert
- [ ] Port 3000 disponible

## Script

### [00:00-03:00] Introduction — Le cycle de vie d'une requete

> Salut ! Aujourd'hui on va explorer les quatre piliers du cycle de vie d'une requete NestJS : les Pipes, les Guards, les Interceptors et les ExceptionFilters. Ensemble, ils forment un pipeline de traitement puissant et flexible.

**Action** : Afficher le slide de titre "Module 13 — Pipes, Guards & Interceptors".

> Quand une requete arrive dans NestJS, elle passe par ces couches dans un ordre precis : Guards (authentification/autorisation), Interceptors (pre-traitement), Pipes (validation/transformation), puis le handler de route, et enfin les Interceptors (post-traitement) et les ExceptionFilters en cas d'erreur.

**Action** : Afficher le schema du cycle de vie.

### [03:00-07:00] Pipes — Validation et transformation

> On a deja vu le ValidationPipe global. Maintenant on va creer nos propres pipes.

**Action** : Creer un pipe personnalise.

```typescript
// src/common/pipes/parse-date.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseDatePipe implements PipeTransform<string, Date> {
  transform(value: string): Date {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`"${value}" n'est pas une date valide`);
    }
    return date;
  }
}
```

**Action** : Utiliser le pipe dans un controller.

```typescript
// src/tasks/tasks.controller.ts
import { ParseDatePipe } from '../common/pipes/parse-date.pipe';

@Controller('tasks')
export class TasksController {
  @Get('by-date')
  findByDate(@Query('from', ParseDatePipe) from: Date) {
    return this.tasksService.findByDate(from);
  }
}
```

**Action** : Tester le pipe.

```bash
# Date valide
curl "http://localhost:3000/tasks/by-date?from=2024-01-15"

# Date invalide
curl "http://localhost:3000/tasks/by-date?from=pas-une-date"
```

> Le pipe transforme la string en Date ou leve une BadRequestException. C'est propre, reutilisable, et testable.

### [07:00-12:00] Guards — Authentification et autorisation

> Les Guards decident si une requete peut passer ou non. C'est l'endroit ideal pour l'authentification et l'autorisation.

**Action** : Creer un AuthGuard.

```typescript
// src/common/guards/auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Token manquant');
    }

    try {
      // En production : jwt.verify(token, SECRET)
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token invalide');
    }
  }
}
```

**Action** : Creer un RolesGuard avec des decorateurs personnalises.

```typescript
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

```typescript
// src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Utilisateur non authentifie');

    const hasRole = requiredRoles.some(role => user.role === role);
    if (!hasRole) throw new ForbiddenException('Role insuffisant');

    return true;
  }
}
```

**Action** : Appliquer les guards sur les routes.

```typescript
// src/tasks/tasks.controller.ts
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('tasks')
@UseGuards(AuthGuard, RolesGuard)
export class TasksController {
  @Get()
  findAll() {
    return this.tasksService.findAll();
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.remove(id);
  }
}
```

> Les guards sont chainees : d'abord l'AuthGuard verifie le token, puis le RolesGuard verifie le role. Si l'un echoue, la requete est rejetee.

### [12:00-16:00] Interceptors — Pre et post-traitement

> Les Interceptors s'executent avant ET apres le handler. Ils peuvent transformer la reponse, logger les performances, ou gerer le cache.

**Action** : Creer un interceptor de logging.

```typescript
// src/common/interceptors/logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const duration = Date.now() - start;
        this.logger.log(`${method} ${url} ${response.statusCode} - ${duration}ms`);
      }),
    );
  }
}
```

**Action** : Creer un interceptor de transformation de reponse.

```typescript
// src/common/interceptors/transform.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

**Action** : Appliquer les interceptors globalement.

```typescript
// src/main.ts
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );
  await app.listen(3000);
}
```

### [16:00-19:00] ExceptionFilter — Gestion d'erreurs personnalisee

> Les ExceptionFilters capturent les exceptions et formatent les reponses d'erreur.

**Action** : Creer un filtre d'exception personnalise.

```typescript
// src/common/filters/http-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception.getStatus();

    const errorResponse = {
      statusCode: status,
      message: exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    this.logger.error(`${request.method} ${request.url} ${status}`);
    response.status(status).json(errorResponse);
  }
}
```

> Le filtre capture toutes les HttpException et renvoie une reponse formatee avec le timestamp et le path.

### [19:00-21:00] Recap

> Resumons le cycle de vie : Guards pour l'authentification et l'autorisation. Pipes pour la validation et la transformation. Interceptors pour le pre/post-traitement. ExceptionFilters pour la gestion d'erreurs. Ensemble, ils forment un pipeline de traitement complet.

**Action** : Afficher le schema du cycle de vie complet.

> Le lab est dans `labs/lab-13-pipes-guards/`. Vous allez implementer chaque couche et voir comment elles interagissent. C'est un module dense mais essentiel. A bientot pour TypeORM !

## Points d'attention pour l'enregistrement
- Bien montrer l'ordre d'execution : Guards -> Interceptors (pre) -> Pipes -> Handler -> Interceptors (post) -> Filters
- Montrer les logs dans le terminal pour visualiser le pipeline
- Insister sur le pattern Observable des Interceptors avec RxJS
- Faire le lien avec les middlewares Express vus au screencast 06
