# Lab 25 — MongoDB et Mongoose

> **Fil-rouge TribuZen :** implémenter `PostSchema` et `PostsService` pour stocker les posts de famille en MongoDB, avec tags libres, sondage optionnel et populate de l'auteur.

## Objectifs

À la fin du lab tu sauras :

- définir un schéma Mongoose avec `@Schema`, `@Prop`, `SchemaFactory`
- injecter `Model<PostDocument>` via `@InjectModel` et écrire un service CRUD
- gérer un champ optionnel (le sondage) absent du document si non fourni
- résoudre une référence avec `populate` + select partiel
- tester avec `mongodb-memory-server` (aucune installation MongoDB requise)

## Structure de départ

```
lab-25-mongodb-mongoose/
  src/
    posts/
      dto/
        create-post.dto.ts   ← fourni — classe DTO avec class-validator
        update-post.dto.ts   ← fourni — PartialType(CreatePostDto)
      schemas/
        post.schema.ts       ← à compléter
      posts.service.ts       ← à compléter
      posts.controller.ts    ← à compléter
      posts.module.ts        ← fourni
    app.module.ts            ← fourni — MongooseModule.forRootAsync + ConfigModule
  test/
    posts.e2e.spec.ts        ← fourni — tests E2E avec MongoMemoryServer
  package.json
  tsconfig.json
```

## Document cible

```ts
// Structure d'un Post TribuZen dans MongoDB
{
  _id: ObjectId,
  author: ObjectId,           // référence vers un User
  family: ObjectId,           // référence vers une Family
  content: string,            // requis
  tags: string[],             // défaut []
  poll?: {                    // optionnel — absent si non fourni
    question: string,
    options: string[],
  },
  status: 'published' | 'draft',  // défaut 'published'
  createdAt: Date,            // géré par timestamps: true
  updatedAt: Date,
}
```

## Étapes

### 1. Schéma (`src/posts/schemas/post.schema.ts`)

Complète le fichier :

- Ajoute `@Schema({ timestamps: true, versionKey: false })` sur la classe `Post`
- Décore chaque propriété avec `@Prop()` et les bonnes options
  - `author` et `family` : `{ type: Types.ObjectId, ref: 'User' }` / `ref: 'Family'`
  - `tags` : tableau de strings avec `default: []`
  - `poll` : objet imbriqué optionnel (sans `required`)
  - `status` : enum `['published', 'draft']` avec `default: 'published'`
- Exporte `PostDocument = HydratedDocument<Post>`
- Génère `export const PostSchema = SchemaFactory.createForClass(Post)`
- Ajoute l'index composite `{ family: 1, createdAt: -1 }` après la génération

### 2. Service (`src/posts/posts.service.ts`)

Implémente les méthodes suivantes dans `PostsService` :

| Méthode | Description |
|---------|-------------|
| `create(dto)` | crée et persiste un nouveau post |
| `findByFamily(familyId)` | retourne les posts publiés d'une famille, triés par date décroissante, avec `lean()` |
| `findOne(id)` | retourne un post par ID, lève `NotFoundException` si absent |
| `findOneWithAuthor(id)` | comme `findOne` mais avec `populate('author', 'name email')` |
| `update(id, dto)` | met à jour avec `{ new: true, runValidators: true }`, lève `NotFoundException` si absent |
| `remove(id)` | supprime, lève `NotFoundException` si absent |

Points de vigilance :
- Convertis `familyId` en `new Types.ObjectId(familyId)` dans les filtres `find()`
- Pense à `.exec()` à la fin de chaque requête

### 3. Controller (`src/posts/posts.controller.ts`)

Crée `PostsController` avec les routes :

| Méthode | Route | Handler |
|---------|-------|---------|
| `POST` | `/posts` | `create(@Body() dto)` |
| `GET` | `/posts/family/:familyId` | `findByFamily(@Param('familyId'))` |
| `GET` | `/posts/:id` | `findOneWithAuthor(@Param('id'))` |
| `PATCH` | `/posts/:id` | `update(@Param('id'), @Body() dto)` |
| `DELETE` | `/posts/:id` | `remove(@Param('id'))` — retourne 204 |

## Lancer les tests

```bash
# Installer les dépendances (mongodb-memory-server inclus)
pnpm install

# Lancer les tests (mode exercice)
pnpm test

# Lancer les tests en mode watch
pnpm test:watch
```

`mongodb-memory-server` télécharge un binaire MongoDB au premier lancement. Aucune installation MongoDB ni Docker n'est nécessaire.

## Critères de validation

- Tous les tests E2E passent au vert
- `POST /posts` sans `content` retourne 400
- `GET /posts/:id` retourne l'auteur populé (objet `{ _id, name, email }` et non un ObjectId)
- `PATCH /posts/:id` retourne le document **après** modification (pas avant)
- `DELETE /posts/:id` retourne 204 No Content

---

## Corrigé commenté

<details>
<summary>Révèle le corrigé (après avoir essayé)</summary>

### post.schema.ts

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type PostDocument = HydratedDocument<Post>

@Schema({ timestamps: true, versionKey: false })
export class Post {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Family', required: true })
  family: Types.ObjectId

  @Prop({ required: true })
  content: string

  @Prop({ type: [String], default: [] })
  tags: string[]

  // poll est optionnel — absent du document si non fourni (pas NULL)
  @Prop({ type: { question: String, options: [String] } })
  poll?: { question: string; options: string[] }

  @Prop({ type: String, enum: ['published', 'draft'], default: 'published' })
  status: string
}

export const PostSchema = SchemaFactory.createForClass(Post)

// Index déclaré après SchemaFactory — couvre la requête de feed la plus fréquente
PostSchema.index({ family: 1, createdAt: -1 })
```

### posts.service.ts

```ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Post, PostDocument } from './schemas/post.schema'
import { CreatePostDto } from './dto/create-post.dto'
import { UpdatePostDto } from './dto/update-post.dto'

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
  ) {}

  async create(dto: CreatePostDto): Promise<Post> {
    return this.postModel.create(dto)
  }

  async findByFamily(familyId: string): Promise<Post[]> {
    // new Types.ObjectId() : conversion string → ObjectId pour le filtre
    return this.postModel
      .find({ family: new Types.ObjectId(familyId), status: 'published' })
      .sort({ createdAt: -1 })
      .lean()
      .exec()
  }

  async findOne(id: string): Promise<PostDocument> {
    const post = await this.postModel.findById(id).exec()
    if (!post) throw new NotFoundException(`Post ${id} introuvable`)
    return post
  }

  async findOneWithAuthor(id: string): Promise<PostDocument> {
    const post = await this.postModel
      .findById(id)
      .populate('author', 'name email')
      .exec()
    if (!post) throw new NotFoundException(`Post ${id} introuvable`)
    return post
  }

  async update(id: string, dto: UpdatePostDto): Promise<Post> {
    const post = await this.postModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
      .exec()
    if (!post) throw new NotFoundException(`Post ${id} introuvable`)
    return post
  }

  async remove(id: string): Promise<void> {
    const result = await this.postModel.findByIdAndDelete(id).exec()
    if (!result) throw new NotFoundException(`Post ${id} introuvable`)
  }
}
```

### posts.controller.ts

```ts
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common'
import { PostsService } from './posts.service'
import { CreatePostDto } from './dto/create-post.dto'
import { UpdatePostDto } from './dto/update-post.dto'

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  create(@Body() dto: CreatePostDto) {
    return this.postsService.create(dto)
  }

  @Get('family/:familyId')
  findByFamily(@Param('familyId') familyId: string) {
    return this.postsService.findByFamily(familyId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findOneWithAuthor(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.postsService.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.postsService.remove(id)
  }
}
```

</details>

---

## Variante J+30

Reviens dans 30 jours et ajoute, **sans regarder le corrigé** :

1. **JournalSchema** — schéma pour le journal privé d'un utilisateur (`author`, `content`, `mood?: 'happy' | 'neutral' | 'sad'`, `tags`, `isPrivate: boolean`). Même pattern `@Schema`/`@Prop`.

2. **Pagination du feed** — modifie `findByFamily` pour accepter `page` et `limit` et retourner `{ data, total, page, lastPage }` (utilise `Promise.all([find(...).skip(...).limit(...), countDocuments(...)])`).

3. **Recherche par tag** — ajoute `findByTag(tag: string)` qui cherche dans le tableau `tags` avec `.find({ tags: tag })`. Ajoute un index simple `{ tags: 1 }` dans le schéma.

4. **Populate imbriqué** — récupère les posts d'une famille avec l'auteur ET le nom de la famille populés en une seule requête (`.populate('author', 'name').populate('family', 'name')`).
