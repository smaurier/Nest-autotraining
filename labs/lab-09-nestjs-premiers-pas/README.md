# Lab 09 — NestJS premiers pas

> **Outcome :** à la fin, tu bootstrappes une API NestJS avec le CLI, génères un module `familles` avec son controller et service, et valides les routes avec curl.
> **Vrai outil :** NestJS CLI `@nestjs/cli ^11` + Node 22 — JAMAIS un harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu pars de zéro et tu bootstrappes l'API TribuZen sous NestJS. À la fin du lab, ces quatre routes répondent correctement depuis `http://localhost:3000/api/familles` :

```
GET    /api/familles          → 200 []
POST   /api/familles          → 201 { id, nom }
GET    /api/familles/:id      → 200 { id, nom } ou 404
DELETE /api/familles/:id      → 204 No Content
```

Contraintes :
- Utiliser uniquement la CLI pour générer les fichiers (`nest g`).
- Le store est en mémoire (tableau) — pas de base de données à ce stade.
- Aucune dépendance externe en dehors de `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` (déjà installées par `nest new`).

## Étapes (en friction)

1. **Bootstrap.** Installe la CLI NestJS globalement si ce n'est pas encore fait. Génère un projet nommé `tribuzen-api` avec pnpm. Lance `pnpm run start:dev` et vérifie que `GET http://localhost:3000` répond `Hello World!`.

2. **Préfixe global.** Dans `src/main.ts`, ajoute `app.setGlobalPrefix('api')` avant `app.listen`. Revalide : `GET http://localhost:3000/api` doit maintenant répondre.

3. **Module familles.** Utilise la CLI pour générer un module `familles`, puis un controller `familles`, puis un service `familles` (trois commandes séparées — pas `nest g resource`). Observe la mise à jour automatique de `app.module.ts`.

4. **Service.** Dans `familles.service.ts`, implémente un store en mémoire (tableau `Famille[]`) avec quatre méthodes : `findAll()`, `findOne(id)`, `create(nom)`, `remove(id)`. Utilise `crypto.randomUUID()` pour les identifiants. Lève `NotFoundException` si l'entité est introuvable.

5. **Controller.** Dans `familles.controller.ts`, câble les quatre routes en injectant `FamillesService` via le constructeur. Utilise `@HttpCode(HttpStatus.CREATED)` sur `create` et `@HttpCode(HttpStatus.NO_CONTENT)` sur `remove`.

6. **Validation curl.** Teste les quatre routes manuellement avec les commandes de la section corrigé. Vérifie les status codes (`201`, `204`, `404`) pas seulement les bodies.

## Corrigé complet commenté

### main.ts

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  // NestFactory.create résout le graphe DI complet avant de répondre à la première requête
  const app = await NestFactory.create(AppModule)

  // Toutes les routes commencent par /api — évite les conflits avec un éventuel frontend
  app.setGlobalPrefix('api')

  // process.env.PORT ?? 3000 — nullish coalescing : utilise 3000 seulement si PORT est null/undefined
  await app.listen(process.env.PORT ?? 3000)
}

bootstrap()
```

### familles.service.ts

```ts
// src/familles/familles.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'

interface Famille {
  id: string
  nom: string
}

// @Injectable() — NestJS lit cette métadonnée au bootstrap pour enregistrer le provider
// Sans ce décorateur, le service ne peut pas être injecté et NestJS lève une erreur
@Injectable()
export class FamillesService {
  // Tableau privé — remplacé par PrismaService au module 10 (PostgreSQL)
  // private = inaccessible depuis le controller, encapsulation respectée
  private readonly familles: Famille[] = []

  findAll(): Famille[] {
    // Retourne le tableau complet — la pagination s'ajoutera au module 10
    return this.familles
  }

  findOne(id: string): Famille {
    const famille = this.familles.find(f => f.id === id)
    // NotFoundException → NestJS répond automatiquement avec { statusCode: 404, message, error }
    // Pas besoin de try/catch dans le controller
    if (!famille) throw new NotFoundException(`Famille ${id} introuvable`)
    return famille
  }

  create(nom: string): Famille {
    // crypto.randomUUID() disponible nativement en Node 22 sans import
    const famille: Famille = { id: crypto.randomUUID(), nom }
    this.familles.push(famille)
    return famille
  }

  remove(id: string): void {
    const index = this.familles.findIndex(f => f.id === id)
    // La même logique 404 — centralisée dans le service, pas dans le controller
    if (index === -1) throw new NotFoundException(`Famille ${id} introuvable`)
    this.familles.splice(index, 1)
    // void — le controller renverra 204 sans body
  }
}
```

### familles.controller.ts

```ts
// src/familles/familles.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { FamillesService } from './familles.service'

// @Controller('familles') — préfixe de ce controller
// Combiné avec setGlobalPrefix('api') → toutes les routes sont sous /api/familles
@Controller('familles')
export class FamillesController {
  // Injection de dépendances via le constructeur
  // private readonly = convention : le service est en lecture seule et privé
  // NestJS résout le type FamillesService et injecte l'instance singleton
  constructor(private readonly famillesService: FamillesService) {}

  // GET /api/familles
  @Get()
  findAll() {
    // NestJS sérialise la valeur de retour en JSON avec status 200 automatiquement
    return this.famillesService.findAll()
  }

  // GET /api/familles/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    // @Param('id') extrait req.params.id — équivalent de req.params.id en Express
    // Si findOne lève NotFoundException, NestJS répond 404 sans que le controller le gère
    return this.famillesService.findOne(id)
  }

  // POST /api/familles
  @Post()
  @HttpCode(HttpStatus.CREATED) // 201 — sans ce décorateur, NestJS répond 200 sur un POST
  create(@Body() body: { nom: string }) {
    // @Body() extrait req.body JSON parsé — NestJS parse automatiquement (pas besoin de express.json())
    return this.famillesService.create(body.nom)
  }

  // DELETE /api/familles/:id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // 204 — pas de body sur un DELETE réussi
  remove(@Param('id') id: string) {
    // remove() retourne void → NestJS envoie 204 sans body
    this.famillesService.remove(id)
  }
}
```

### familles.module.ts

```ts
// src/familles/familles.module.ts
import { Module } from '@nestjs/common'
import { FamillesController } from './familles.controller'
import { FamillesService } from './familles.service'

@Module({
  // controllers — NestJS enregistre leurs routes dans le router HTTP
  // Ne pas mettre les services ici — ils ne sont pas des handlers de routes
  controllers: [FamillesController],

  // providers — NestJS instancie et injecte ces classes
  // Sans cette ligne, FamillesController ne peut pas recevoir FamillesService
  providers: [FamillesService],

  // exports : non nécessaire ici, FamillesService n'est pas consommé par d'autres modules
  // exports: [FamillesService]
})
export class FamillesModule {}
```

### app.module.ts (mis à jour par la CLI)

```ts
// src/app.module.ts
import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { FamillesModule } from './familles/familles.module'

@Module({
  // La CLI a ajouté FamillesModule automatiquement lors de `nest g module familles`
  imports: [FamillesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### Validation curl

```bash
# Lancer le serveur en dev
pnpm run start:dev

# GET liste vide
curl http://localhost:3000/api/familles
# → []

# POST créer
curl -X POST http://localhost:3000/api/familles \
  -H "Content-Type: application/json" \
  -d '{"nom":"Famille Martin"}'
# → {"id":"...uuid...","nom":"Famille Martin"}

# GET par id (remplacer UUID par la valeur retournée par le POST)
curl http://localhost:3000/api/familles/UUID_ICI
# → {"id":"...","nom":"Famille Martin"}

# GET id inconnu → 404
curl http://localhost:3000/api/familles/inexistant
# → {"statusCode":404,"message":"Famille inexistant introuvable","error":"Not Found"}

# DELETE (remplacer UUID)
curl -X DELETE http://localhost:3000/api/familles/UUID_ICI -v
# → HTTP/1.1 204 No Content, body vide
```

## Variante J+30 (fading)

Même contrainte, en 25 minutes, sans regarder le corrigé :

- Reproduire les quatre routes depuis zéro avec `nest g` seulement.
- Ajouter une cinquième route `PATCH /api/familles/:id` qui accepte `{ nom?: string }` et met à jour le nom si fourni.
- Sans regarder la doc : retrouver les noms des décorateurs pour `@Body()`, `@Param()`, `@HttpCode()`.

Contrainte supplémentaire : créer un second module `PostsModule` qui injecte `FamillesService` pour valider qu'une famille existe avant de créer un post. Valide que tu maîtrises le mécanisme `exports`/`imports` entre modules.

## Application TribuZen

Ce lab pose la fondation de `smaurier/tribuzen` :

```
tribuzen/
  apps/
    api/
      src/
        familles/
          familles.module.ts
          familles.controller.ts
          familles.service.ts
        app.module.ts
        main.ts
```

Commit cible dans `smaurier/tribuzen` : `feat(api): bootstrap NestJS + module familles (store mémoire)`.

Les modules suivants font évoluer cette base :
- **Module 10** : DTOs typés avec `class-validator`, `@Query` avec pagination, gestion des erreurs centralisée.
- **Module 11** : `PostsModule` et `InvitationsModule` ajoutés, partage de `FamillesService` via `exports`.
- **Module 12** : le store mémoire est remplacé par `PrismaService` + PostgreSQL.
