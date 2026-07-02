---
titre: MongoDB et Mongoose
cours: 09-nestjs
notions: [MongoDB et le modèle document, schémas Mongoose et décorateur Schema, documents et models, types et validation, références et population, requêtes Mongoose, intégration NestJS via MongooseModule, quand choisir NoSQL vs SQL]
outcomes: [définir un schéma Mongoose avec NestJS, faire du CRUD sur des documents, gérer des références et la population, décider NoSQL vs relationnel selon le cas]
prerequis: [24-projet-final]
next: 26-graphql-nestjs
libs: [{ name: "@nestjs/mongoose", version: "^11" }, { name: mongoose, version: "^8" }]
tribuzen: stocker le journal et les posts TribuZen en MongoDB (orienté document) et comparer avec le relationnel
last-reviewed: 2026-07
---

# MongoDB et Mongoose

> **Outcomes — tu sauras FAIRE :** définir un schéma Mongoose avec `@Schema`/`@Prop`, faire du CRUD sur des documents avec `@InjectModel`, gérer des références et la population, décider quand utiliser MongoDB plutôt qu'un SGBD relationnel.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

TribuZen stocke ses `Post` en PostgreSQL via Prisma. Ça tient. Mais un post de la famille Martin contient du texte, trois tags et un sondage intégré ; un post de la famille Dupont contient du texte, dix médias, une liste de réactions emoji et des métadonnées de localisation. Avec Prisma, chaque ajout de champ nécessite une migration et un `ALTER TABLE`. Les champs inutilisés sont `NULL` pour 90 % des familles.

Tu essaies d'ajouter le sondage :

```ts
// ❌ avec Prisma — migration obligatoire, colonne NULL pour les posts sans sondage
model Post {
  id      String  @id @default(cuid())
  content String
  poll    Json?   // toutes les lignes portent ce champ même sans sondage
}
```

MongoDB résout ça différemment : chaque document est autonome. Les posts qui ont un sondage le portent ; les autres n'ont pas le champ du tout.

```ts
// ✅ avec Mongoose — chaque post porte exactement ce qu'il contient
await postModel.create({
  content: 'Notre week-end à la mer',
  tags: ['vacances', 'mer'],
  poll: { question: 'On repart quand ?', options: ['Juillet', 'Août'] },
})

await postModel.create({
  content: 'Bonne nuit la famille',
  tags: [],
  // pas de champ poll — absent, pas NULL
})
```

Ce module couvre le modèle document, les schémas Mongoose avec décorateurs NestJS, le CRUD, les références et la population, et la décision NoSQL vs SQL.

## 2. Théorie complète, concise

### 2.1 Le modèle document

MongoDB stocke des **documents** BSON (Binary JSON) dans des **collections**. Un document est un objet JSON autonome avec un `_id` (ObjectId généré automatiquement). Pas de colonnes fixes, pas de schéma imposé par la base elle-même.

Correspondance terminologique SQL → MongoDB :

| SQL | MongoDB |
|-----|---------|
| Table | Collection |
| Ligne | Document |
| Colonne | Champ (field) |
| Primary key | `_id` (ObjectId) |
| JOIN | `populate()` / `$lookup` |
| NULL optionnel | champ absent du document |

Les documents d'une même collection peuvent avoir des structures différentes — c'est le schéma flexible. En pratique, on utilise Mongoose pour imposer une structure cohérente côté application via des schémas validés.

### 2.2 Schéma Mongoose et décorateur Schema

`@nestjs/mongoose` fournit trois éléments : `@Schema()` (décorateur de classe), `@Prop()` (décorateur de propriété), et `SchemaFactory.createForClass()` (génération du schéma Mongoose depuis les métadonnées TypeScript).

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

// HydratedDocument<Post> = Post + méthodes Mongoose (.save(), .toObject()...)
export type PostDocument = HydratedDocument<Post>

@Schema({
  timestamps: true,   // ajoute createdAt et updatedAt automatiquement
  versionKey: false,  // désactive le champ __v (version interne Mongoose)
})
export class Post {
  @Prop({ required: true })
  content: string

  @Prop({ type: [String], default: [] })
  tags: string[]

  @Prop({
    type: String,
    enum: ['published', 'draft', 'archived'],
    default: 'published',
  })
  status: string
}

// SchemaFactory lit les métadonnées @Prop() et génère le schéma Mongoose
export const PostSchema = SchemaFactory.createForClass(Post)
```

Options courantes de `@Prop()` :

| Option | Effet |
|--------|-------|
| `required: true` | champ obligatoire à l'insertion |
| `default: valeur` | valeur par défaut appliquée automatiquement |
| `unique: true` | contrainte d'unicité (crée aussi un index) |
| `min` / `max` | bornes numériques |
| `minlength` / `maxlength` | bornes de longueur de chaîne |
| `enum: [...]` | valeurs autorisées |
| `type: Types.ObjectId, ref: 'Model'` | référence vers un autre modèle |

### 2.3 Documents, HydratedDocument et lean

`HydratedDocument<T>` est le type TypeScript d'un document Mongoose complet, avec ses méthodes (`.save()`, `.toObject()`, accès aux virtuals). Pour les lectures en API REST, `lean()` retourne un plain object JS deux fois plus rapide — sans les méthodes Mongoose.

```ts
// Document hydraté — .save() disponible, virtuals accessibles
const doc = await postModel.findById(id).exec()
// doc.save() ← disponible
// typeof doc → PostDocument (HydratedDocument<Post>)

// Plain object — plus rapide pour une API REST, pas de méthodes Mongoose
const raw = await postModel.findById(id).lean().exec()
// raw.save() ← TypeError, c'est un plain object
// typeof raw → Post & { _id: Types.ObjectId }
```

### 2.4 Intégration NestJS via MongooseModule

`MongooseModule.forRootAsync()` configure la connexion globale dans `AppModule`. `MongooseModule.forFeature()` enregistre les schémas dans le module métier concerné.

```ts
// app.module.ts
import { MongooseModule } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      // useFactory async — ConfigService disponible après résolution du module Config
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
  ],
})
export class AppModule {}
```

```ts
// posts.module.ts
import { MongooseModule } from '@nestjs/mongoose'
import { Post, PostSchema } from './schemas/post.schema'

@Module({
  imports: [
    // forFeature enregistre le schéma dans ce module uniquement
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
    ]),
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
```

`Post.name` est la valeur de la propriété statique `name` de la classe TypeScript — ici la string `'Post'`. Mongoose utilise ce nom pour nommer la collection (automatiquement mis en minuscule et au pluriel : `posts`).

### 2.5 InjectModel et requêtes Mongoose

`@InjectModel(Post.name)` injecte le Model Mongoose dans le service. Le Model expose les méthodes de requête.

```ts
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

@Injectable()
export class PostsService {
  constructor(
    // token = 'Post' (Post.name) — doit correspondre à forFeature([{ name: Post.name }])
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
  ) {}
}
```

Méthodes CRUD essentielles :

| Opération | Méthode Mongoose |
|-----------|-----------------|
| Créer | `create(data)` |
| Lire tous | `find(filter).exec()` |
| Lire un | `findById(id).exec()` |
| Mettre à jour | `findByIdAndUpdate(id, { $set: data }, { new: true }).exec()` |
| Supprimer | `findByIdAndDelete(id).exec()` |

`{ new: true }` dans `findByIdAndUpdate` retourne le document **après** modification. Par défaut Mongoose retourne l'état **avant** — toujours passer cette option.

### 2.6 Références et population

MongoDB offre deux stratégies pour modéliser une relation :

**Embedding** — le document lié est imbriqué dans le parent. Une seule requête, mais données potentiellement dupliquées.

**Referencing** — seul l'ObjectId est stocké ; `populate()` le résout en document complet via une requête supplémentaire groupée.

```ts
// Référence : Post appartient à un User (auteur)
@Prop({ type: Types.ObjectId, ref: 'User', required: true })
author: Types.ObjectId
```

```ts
// Résolution avec populate
const post = await this.postModel
  .findById(id)
  .populate('author', 'name email')  // select partiel — name et email uniquement
  .exec()
// post.author est maintenant un objet { _id, name, email }
```

Règle de décision :

| Critère | Embedding | Referencing |
|---------|-----------|-------------|
| Lecture | une seule requête | requête supplémentaire |
| Taille | stable, < 16 MB | potentiellement grande |
| Mise à jour | source unique dans le parent | centralisée dans la collection cible |
| Cas TribuZen | `poll` optionnel dans un post | `author` (User) d'un post |

### 2.7 Quand choisir NoSQL vs SQL

| Critère | MongoDB | PostgreSQL |
|---------|---------|-----------|
| Structure | variable, semi-structurée | fixe, tabulaire |
| Ajout de champ | sans migration | `ALTER TABLE` + migration |
| Relations | légères (populate) | complexes (JOIN natif) |
| Transactions ACID | disponibles, coût de latence | ACID natif |
| Cas TribuZen | posts, journal, feed | users, familles, invitations |

Règle pragmatique : si tes données ressemblent à un tableur avec des colonnes fixes et des relations nombreuses → PostgreSQL. Si tes documents ont des structures variables ou des champs optionnels nombreux → MongoDB. Les deux cohabitent souvent dans un même projet (polyglot persistence).

## 3. Worked examples

### Exemple A — PostSchema TribuZen et CRUD complet

```ts
// src/posts/schemas/post.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type PostDocument = HydratedDocument<Post>

@Schema({ timestamps: true, versionKey: false })
export class Post {
  // Référence vers un User — ObjectId stocké, populate() résout en document
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId

  // Référence vers une Family
  @Prop({ type: Types.ObjectId, ref: 'Family', required: true })
  family: Types.ObjectId

  @Prop({ required: true })
  content: string

  // Tags TribuZen : tableau de strings flexible (0 à N tags)
  @Prop({ type: [String], default: [] })
  tags: string[]

  // Sondage optionnel — absent du document si le post n'en a pas
  @Prop({
    type: {
      question: String,
      options: [String],
    },
  })
  poll?: { question: string; options: string[] }

  @Prop({
    type: String,
    enum: ['published', 'draft'],
    default: 'published',
  })
  status: string
}

export const PostSchema = SchemaFactory.createForClass(Post)

// Index composite : feed d'une famille trié par date — requête la plus fréquente
PostSchema.index({ family: 1, createdAt: -1 })
```

```ts
// src/posts/posts.service.ts
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

  // CREATE — create() déclenche la validation du schéma
  async create(dto: CreatePostDto): Promise<Post> {
    return this.postModel.create(dto)
  }

  // READ — feed d'une famille, du plus récent au plus ancien
  async findByFamily(familyId: string): Promise<Post[]> {
    return this.postModel
      .find({ family: new Types.ObjectId(familyId), status: 'published' })
      .sort({ createdAt: -1 })
      .lean()   // plain object — plus rapide pour une API REST
      .exec()
  }

  // READ ONE avec vérification d'existence
  async findOne(id: string): Promise<PostDocument> {
    const post = await this.postModel.findById(id).exec()
    if (!post) throw new NotFoundException(`Post ${id} introuvable`)
    return post
  }

  // UPDATE — { new: true } retourne le document APRÈS modification
  async update(id: string, dto: UpdatePostDto): Promise<Post> {
    const post = await this.postModel
      .findByIdAndUpdate(
        id,
        { $set: dto },
        { new: true, runValidators: true },
      )
      .exec()
    if (!post) throw new NotFoundException(`Post ${id} introuvable`)
    return post
  }

  // DELETE
  async remove(id: string): Promise<void> {
    const result = await this.postModel.findByIdAndDelete(id).exec()
    if (!result) throw new NotFoundException(`Post ${id} introuvable`)
  }
}
```

```ts
// src/posts/posts.module.ts
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Post, PostSchema } from './schemas/post.schema'
import { PostsService } from './posts.service'
import { PostsController } from './posts.controller'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
    ]),
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
```

**Pas-à-pas :**
1. `@Schema({ timestamps: true })` — ajoute `createdAt` et `updatedAt` automatiquement ; `versionKey: false` supprime le champ `__v` inutile en API.
2. `poll?` sans `required` — le champ est absent du document si non fourni, ce qui est fondamentalement différent d'une colonne `NULL` SQL.
3. `PostSchema.index({ family: 1, createdAt: -1 })` — déclaré après `SchemaFactory.createForClass()` ; cet index composite couvre la requête de feed (filtre sur `family`, tri sur `createdAt`).
4. `new Types.ObjectId(familyId)` dans `find` — conversion explicite d'une string HTTP en ObjectId pour le filtre Mongoose.
5. `{ runValidators: true }` dans `findByIdAndUpdate` — nécessaire pour déclencher les validateurs du schéma à l'update (ignorés par défaut).

### Exemple B — Références et populate

```ts
// src/posts/posts.service.ts (méthodes avec populate)
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Post, PostDocument } from './schemas/post.schema'

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
  ) {}

  // Récupère un post avec l'auteur populé (name et email seulement)
  async findOneWithAuthor(id: string): Promise<PostDocument> {
    const post = await this.postModel
      .findById(id)
      .populate('author', 'name email') // select partiel sur la collection users
      .exec()
    if (!post) throw new NotFoundException(`Post ${id} introuvable`)
    return post
    // post.author est maintenant { _id, name, email } au lieu d'un ObjectId
  }

  // Feed famille avec auteur — populate sur find()
  async findByFamilyWithAuthors(familyId: string): Promise<Post[]> {
    return this.postModel
      .find({ family: new Types.ObjectId(familyId), status: 'published' })
      .populate('author', 'name')     // uniquement le nom pour le feed
      .sort({ createdAt: -1 })
      .limit(20)                      // toujours limiter — évite les payloads explosifs
      .lean()
      .exec()
  }
}
```

**Pas-à-pas :**
1. `.populate('author', 'name email')` — Mongoose émet une seule requête groupée `find({ _id: { $in: [...ids] } })` sur la collection `users` et remplace chaque ObjectId par son document. Le deuxième argument est un **select** : seuls `name` et `email` transitent.
2. `populate` sur `find()` — Mongoose **batch** tous les IDs en une seule requête secondaire, pas une par document. Le N+1 classique n'est pas automatique ici, mais `limit(20)` reste important pour contrôler la taille du payload.
3. `.limit(20).lean()` — combinaison recommandée pour les listes en API REST : payload maîtrisé et performance maximale (plain objects sans surcharge Mongoose).
4. `post.author` après `populate` — le type est `any` en TypeScript sans cast explicite. Pour un typage strict, utiliser `populate<{ author: User }>('author', 'name email')` (Mongoose 8+ supporte les génériques sur populate).

## 4. Pièges & misconceptions

- **`findByIdAndUpdate` sans `{ new: true }`.** Par défaut, Mongoose retourne le document **avant** modification. Renvoyer ce résultat directement en réponse HTTP, c'est envoyer l'ancienne version. Correction : toujours passer `{ new: true, runValidators: true }` ensemble.

- **`findByIdAndUpdate` ignore les validateurs par défaut.** `create()` et `.save()` valident contre le schéma. `findByIdAndUpdate` contourne le middleware Mongoose et ignore les validateurs sauf si tu passes `{ runValidators: true }`. Un champ `required` peut devenir `null` sans erreur sans cette option.

- **String vs ObjectId dans les filtres.** Un paramètre HTTP est une string. `findById(id)` accepte une string et la convertit automatiquement. Mais dans `find({ family: familyId })` où `family` est déclaré `Types.ObjectId` dans le schéma, une string peut ne pas matcher selon la version de Mongoose. Convention : `new Types.ObjectId(familyId)` dans les filtres composés.

- **Oublier `.exec()`.** Sans `.exec()`, Mongoose retourne un objet Query "thenable" — `await` fonctionnera, mais les stack traces seront tronqués en cas d'erreur. La convention est de toujours terminer les requêtes par `.exec()` pour avoir des erreurs lisibles.

- **`@Schema()` sans `SchemaFactory.createForClass()`.** Le décorateur seul ne génère pas le schéma Mongoose. Si tu passes la classe directement à `forFeature` au lieu de `PostSchema`, NestJS lève une erreur d'initialisation du module. Les trois étapes sont solidaires.

- **Embedding de données volumineuses ou fréquemment modifiées.** Imbriquer les commentaires dans un post semble naturel. Mais si un post reçoit 500 commentaires, le document peut dépasser 16 MB (limite MongoDB par document). Règle : embed les données lues ensemble et peu volumineuses ; reference les données indépendantes, volumineuses ou partagées.

- **`populate()` sans `.limit()` sur une liste.** `populate()` émet des requêtes secondaires proportionnelles aux IDs distincts. Sur un feed de 500 posts avec populate de l'auteur, Mongoose peut émettre une requête secondaire sur des centaines d'IDs. Toujours combiner `populate` avec `limit` et `select`.

## 5. Ancrage TribuZen

Couche fil-rouge : **stocker le journal et les posts TribuZen en MongoDB (orienté document) et comparer avec le relationnel** (`smaurier/tribuzen`).

- `PostSchema` avec `tags: string[]` et `poll?: { question, options }` modélise exactement le problème initial : chaque famille peut publier des posts avec des structures différentes sans migration. Les familles qui n'utilisent pas les sondages n'ont simplement pas le champ `poll` dans leurs documents.
- `author: Types.ObjectId` et `family: Types.ObjectId` — deux références qui permettent à TribuZen d'adopter une persistance hybride : `User` et `Family` restent en PostgreSQL (relations strictes, invitations, transactions ACID), `Post` et `Journal` en MongoDB (documents flexibles, feed chronologique).
- L'index `{ family: 1, createdAt: -1 }` optimise la requête la plus fréquente de TribuZen : charger le feed d'une famille trié par date. Sans cet index, MongoDB scannerait tous les posts à chaque requête de feed.
- `JournalSchema` (journal privé de l'utilisateur) suit le même pattern `@Schema`/`@Prop`/`@InjectModel` — chaque entrée peut contenir du texte libre, des photos, une humeur (enum), des tags libres, un lieu. Aucune migration pour ajouter une humeur ou un lieu six mois après le lancement.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  posts/
    schemas/
      post.schema.ts       ← @Schema, @Prop, PostSchema, PostDocument
    posts.service.ts       ← @InjectModel(Post.name), CRUD + populate
    posts.controller.ts
    posts.module.ts        ← forFeature([{ name: Post.name, schema: PostSchema }])
  journal/
    schemas/
      journal.schema.ts    ← même pattern que PostSchema
    journal.service.ts
    journal.module.ts
  app.module.ts            ← MongooseModule.forRootAsync(MONGODB_URI)
```

## 6. Points clés

1. MongoDB stocke des documents BSON flexibles dans des collections — pas de colonnes fixes, un champ absent est absent (pas `NULL`), pas de migration pour ajouter un champ optionnel.
2. `@Schema()` sur la classe + `@Prop()` sur les propriétés + `SchemaFactory.createForClass(MaClasse)` = les trois étapes solidaires pour définir un schéma Mongoose dans NestJS.
3. `MongooseModule.forRootAsync()` dans `AppModule` (connexion globale) + `MongooseModule.forFeature([...])` dans chaque module métier (enregistrement des schémas et activation de `@InjectModel`).
4. `@InjectModel(Post.name)` injecte `Model<PostDocument>` — le token est le nom de la classe TypeScript, pas un string arbitraire.
5. `findByIdAndUpdate` requiert `{ new: true }` pour obtenir le document après modification, et `{ runValidators: true }` pour déclencher la validation du schéma.
6. `populate('author', 'name email')` résout un ObjectId en document complet via une requête groupée ; le deuxième argument est un select qui limite les champs chargés.
7. **Embedding** pour les données lues ensemble, peu volumineuses et peu modifiées ; **Referencing** pour les données mises à jour indépendamment, volumineuses ou partagées entre documents.
8. `.lean()` retourne un plain object JS au lieu d'un HydratedDocument Mongoose — significativement plus rapide pour les lectures en API REST.
9. PostgreSQL reste le bon choix pour les relations strictes, les contraintes d'intégrité et les transactions ACID fréquentes. TribuZen utilise les deux : PostgreSQL pour `User`/`Family`/`Invitation`, MongoDB pour `Post`/`Journal`.

## 7. Seeds Anki

```
Quelles sont les trois étapes solidaires pour définir un schéma Mongoose dans NestJS ?|@Schema() sur la classe + @Prop() sur les propriétés + SchemaFactory.createForClass(MaClasse) — sans la troisième étape le schéma n'est pas généré
Différence entre MongooseModule.forRoot et forFeature ?|forRoot configure la connexion globale MongoDB dans AppModule ; forFeature enregistre les schémas d'un module métier et rend @InjectModel disponible dans ce module
Que retourne findByIdAndUpdate sans option { new: true } ?|Le document avant modification — toujours passer { new: true } pour obtenir le document après update, et { runValidators: true } pour déclencher la validation du schéma
Pourquoi utiliser lean() sur une requête find() ?|lean() retourne un plain object JavaScript au lieu d'un HydratedDocument Mongoose — environ 2x plus rapide et moins de mémoire, idéal pour les lectures en API REST
Comment déclarer une référence vers un autre document avec @Prop ?|@Prop({ type: Types.ObjectId, ref: 'NomDuModele' }) — Types.ObjectId est le type BSON, ref indique le nom du modèle Mongoose cible pour populate
Que fait populate('author', 'name email') ?|Remplace l'ObjectId stocké dans author par le document User complet en chargeant uniquement name et email — Mongoose émet une seule requête groupée, pas une par document
Quand choisir MongoDB plutôt que PostgreSQL pour TribuZen ?|Pour les données à structure variable ou optionnelle comme posts et journal — PostgreSQL reste préférable pour User, Family et Invitation qui ont des relations strictes et des contraintes ACID
Pourquoi findByIdAndUpdate n'exécute-t-il pas les validateurs par défaut ?|findByIdAndUpdate contourne le middleware Mongoose et les validateurs du schéma — il faut explicitement passer { runValidators: true } pour les déclencher
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-25-mongodb-mongoose/README.md`. Tu y implémentes `PostSchema` et `PostsService` TribuZen (schéma avec tags et poll optionnel, CRUD complet, populate de l'auteur) — corrigé complet commenté + variante J+30 dans le README du lab.
