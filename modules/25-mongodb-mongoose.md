# Module 25 — MongoDB & Mongoose — Base de donnees NoSQL

> **Objectif** : Comprendre les differences fondamentales entre SQL et NoSQL, installer et configurer MongoDB avec NestJS via @nestjs/mongoose, maitriser les schemas, les operations CRUD, les relations, les indexes, l'aggregation pipeline et les transactions.
>
> **Difficulte** : ⭐⭐⭐ (avance)

---

## 1. SQL vs NoSQL — Deux philosophies

### 1.1 Le modele relationnel (PostgreSQL, MySQL)

Les bases relationnelles organisent les donnees en **tables** avec des **schemas fixes**. Les relations sont explicites via les cles etrangeres. C'est le modele que tu connais si tu as suivi les modules TypeORM et Prisma.

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category_id INTEGER REFERENCES categories(id)
);
```

### 1.2 Le modele document (MongoDB)

MongoDB stocke des **documents JSON** (BSON) dans des **collections**. Pas de schema fixe impose par la base — la structure est flexible.

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "MacBook Pro 16",
  "price": 2499.99,
  "specs": {
    "cpu": "M3 Pro",
    "ram": "18GB",
    "storage": "512GB SSD"
  },
  "tags": ["laptop", "apple", "pro"],
  "reviews": [
    { "user": "alice", "rating": 5, "comment": "Excellent" }
  ]
}
```

> **Analogie** : Imagine deux facons de ranger une bibliotheque. SQL, c'est une bibliotheque traditionnelle : chaque livre a une fiche dans un catalogue central, chaque fiche respecte exactement le meme format (titre, auteur, ISBN, emplacement). NoSQL, c'est plutot une bibliotheque ou chaque etagere peut organiser ses livres differemment — certains par theme, d'autres par taille, et tu peux ajouter des annotations directement dans le livre sans modifier le catalogue.

### 1.3 Tableau comparatif

```
┌─────────────────────┬──────────────────────────────┬──────────────────────────────┐
│     Critere         │      PostgreSQL (SQL)         │      MongoDB (NoSQL)         │
├─────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Modele de donnees   │ Tables avec lignes et        │ Collections avec documents   │
│                     │ colonnes fixes               │ JSON/BSON flexibles          │
├─────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Schema              │ Rigide, defini a l'avance    │ Flexible, peut varier par    │
│                     │ (ALTER TABLE pour modifier)  │ document                     │
├─────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Relations           │ JOINs entre tables           │ Embedding ou referencing     │
│                     │ (cles etrangeres)            │ (populate)                   │
├─────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Transactions        │ ACID complet natif           │ ACID multi-documents         │
│                     │                              │ (depuis MongoDB 4.0)         │
├─────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Scalabilite         │ Verticale (plus de RAM/CPU)  │ Horizontale (sharding natif) │
├─────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Requetes            │ SQL standardise              │ Query API + Aggregation      │
│                     │                              │ Pipeline                     │
├─────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Cas d'usage ideal   │ Donnees structurees,         │ Donnees semi-structurees,    │
│                     │ relations complexes,         │ prototypage rapide,          │
│                     │ integrite referentielle      │ schemas evolutifs            │
├─────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ ORM NestJS          │ TypeORM, Prisma              │ Mongoose (@nestjs/mongoose)  │
└─────────────────────┴──────────────────────────────┴──────────────────────────────┘
```

### 1.4 Terminologie SQL → MongoDB

```
┌──────────────────┬──────────────────────┐
│  SQL             │  MongoDB             │
├──────────────────┼──────────────────────┤
│  Database        │  Database            │
│  Table           │  Collection          │
│  Row             │  Document            │
│  Column          │  Field               │
│  Primary Key     │  _id (ObjectId)      │
│  JOIN            │  $lookup / populate  │
│  Index           │  Index               │
│  Transaction     │  Transaction         │
└──────────────────┴──────────────────────┘
```

### 1.5 Quand choisir MongoDB ?

- Donnees semi-structurees ou dont le schema evolue frequemment
- Catalogues produits avec des attributs variables
- Logs, evenements, donnees IoT
- Prototypage rapide (pas besoin de migrations)
- Applications necessitant du scaling horizontal
- Documents imbriques naturels (profils utilisateur, configurations)

### 1.6 Quand rester sur PostgreSQL ?

- Relations complexes avec beaucoup de JOIN
- Transactions multi-tables frequentes
- Reporting et analytique SQL avancee
- Contraintes d'integrite critiques
- Donnees financieres, comptabilite

> **Regle pragmatique** : Si tes donnees ressemblent a un tableur avec des colonnes fixes et des relations → PostgreSQL. Si tes donnees ressemblent a des documents JSON avec des structures variables → MongoDB. En pratique, beaucoup de projets utilisent les deux (polyglot persistence).

---

## 2. MongoDB — Concepts fondamentaux

### 2.1 Architecture

```
MongoDB Server
├── Database "ecommerce"
│   ├── Collection "products"
│   │   ├── Document { _id: ..., name: "MacBook", price: 2499, specs: {...} }
│   │   ├── Document { _id: ..., name: "T-shirt", price: 29, sizes: [...] }
│   │   └── Document { _id: ..., name: "Cafe", price: 8.50, weight: "250g" }
│   ├── Collection "orders"
│   │   └── { _id: ..., items: [...], total: 2528.50, status: "shipped" }
│   └── Collection "users"
│       └── { _id: ..., email: "jean@mail.com", addresses: [...] }
└── Database "admin"
    └── ...
```

### 2.2 BSON — Binary JSON

MongoDB stocke les documents en **BSON** (Binary JSON), une extension binaire de JSON qui ajoute des types supplementaires :

```
┌───────────────────┬───────────────────────────────────────────────┐
│  Type BSON        │  Description                                  │
├───────────────────┼───────────────────────────────────────────────┤
│  ObjectId         │  Identifiant unique 12 bytes (par defaut _id) │
│  String           │  Chaine UTF-8                                 │
│  Number (Int32,   │  Entiers et doubles                           │
│    Int64, Double) │                                               │
│  Boolean          │  true / false                                 │
│  Date             │  Date au format millisecondes                 │
│  Array            │  Tableau ordonne                              │
│  Object           │  Document imbrique                            │
│  Decimal128       │  Precision decimale (prix, monnaie)           │
│  Binary           │  Donnees binaires                             │
│  Null             │  Valeur nulle                                 │
└───────────────────┴───────────────────────────────────────────────┘
```

### 2.3 ObjectId

Chaque document a un champ `_id` unique. Par defaut, MongoDB genere un `ObjectId` de 12 octets :

```
|  4 bytes  |  5 bytes  | 3 bytes |
| timestamp | random    | counter |
```

Cela signifie que les ObjectId sont **ordonnes chronologiquement** — utile pour le tri par date de creation sans champ supplementaire.

### 2.4 MongoDB Shell — Commandes essentielles

```javascript
// Connexion
mongosh "mongodb://localhost:27017"

// Bases de donnees
show dbs
use ecommerce

// Collections
show collections
db.createCollection("products")

// CRUD
db.products.insertOne({ name: "MacBook", price: 2499 })
db.products.find({ price: { $gt: 1000 } }).pretty()
db.products.updateOne({ _id: id }, { $set: { price: 2299 } })
db.products.deleteOne({ _id: id })

// Comptage et index
db.products.countDocuments()
db.products.createIndex({ name: 1 })
db.products.getIndexes()

// Aggregation
db.products.aggregate([
  { $match: { price: { $gt: 100 } } },
  { $group: { _id: "$category", avgPrice: { $avg: "$price" } } }
])
```

> **Bonne pratique** : Meme si MongoDB est "schema-less", en pratique on utilise toujours Mongoose ou la validation de schema MongoDB pour imposer une structure coherente. Un schema flexible ne veut pas dire "pas de schema" — ca veut dire "schema evolutif".

---

## 3. Mongoose avec NestJS — Installation et configuration

### 3.1 Prerequis

```bash
# Lancer MongoDB avec Docker (methode recommandee)
docker run -d --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=secret \
  -v mongodb_data:/data/db \
  mongo:7

# Verifier que MongoDB fonctionne
docker exec -it mongodb mongosh --username admin --password secret
```

### 3.2 Installer les dependances

```bash
npm install @nestjs/mongoose mongoose
```

### 3.3 MongooseModule.forRoot — Connexion globale

La methode la plus simple pour connecter MongoDB a NestJS :

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/ecommerce'),
  ],
})
export class AppModule {}
```

### 3.4 MongooseModule.forRootAsync — Configuration dynamique

En production, on ne hardcode jamais l'URI de connexion. On utilise `forRootAsync` avec le ConfigService :

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        retryWrites: true,
        w: 'majority',
      }),
    }),
  ],
})
export class AppModule {}
```

```bash
# .env
MONGODB_URI=mongodb://admin:secret@localhost:27017/ecommerce?authSource=admin
```

> **Piege classique** : Si tu oublies `authSource=admin` dans l'URI quand tu utilises l'authentification, Mongoose va essayer de s'authentifier sur la base `ecommerce` au lieu de la base `admin`, et tu auras une erreur `Authentication failed`.

### 3.5 Options de connexion utiles

```typescript
MongooseModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    uri: config.getOrThrow<string>('MONGODB_URI'),
    // Timeout de connexion (par defaut 30s)
    connectTimeoutMS: 10000,
    // Timeout pour les operations (par defaut pas de timeout)
    socketTimeoutMS: 45000,
    // Nombre max de connexions dans le pool (par defaut 100)
    maxPoolSize: 50,
    // Nombre min de connexions dans le pool (par defaut 0)
    minPoolSize: 5,
    // Active la compression des donnees
    compressors: ['zstd', 'snappy'],
  }),
}),
```

### 3.6 Connexions multiples

Si ton application doit se connecter a plusieurs bases MongoDB :

```typescript
@Module({
  imports: [
    // Base principale
    MongooseModule.forRoot('mongodb://localhost/ecommerce', {
      connectionName: 'ecommerce',
    }),
    // Base de logs/analytics
    MongooseModule.forRoot('mongodb://localhost/analytics', {
      connectionName: 'analytics',
    }),
  ],
})
export class AppModule {}

// Dans un feature module, specifier la connexion
@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Product.name, schema: ProductSchema }],
      'ecommerce', // nom de la connexion
    ),
  ],
})
export class ProductsModule {}
```

---

## 4. Schemas et validation avec decorateurs

### 4.1 Definir un schema avec @Schema et @Prop

Mongoose utilise des schemas pour definir la structure des documents. Avec `@nestjs/mongoose`, on utilise des decorateurs TypeScript :

```typescript
// product.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

// Type utilitaire pour typer les documents retournes
export type ProductDocument = HydratedDocument<Product>;

@Schema({
  timestamps: true,         // Ajoute createdAt et updatedAt automatiquement
  collection: 'products',   // Nom explicite de la collection
  versionKey: false,        // Desactive le champ __v
  toJSON: { virtuals: true },
})
export class Product {
  @Prop({ required: true, trim: true, maxlength: 200 })
  name: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0, default: 0 })
  stock: number;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  category: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'draft',
  })
  status: string;

  @Prop({ default: true })
  isActive: boolean;
}

// Genere le schema Mongoose a partir de la classe
export const ProductSchema = SchemaFactory.createForClass(Product);
```

### 4.2 Options de @Prop en detail

Le decorateur `@Prop` accepte de nombreuses options de validation :

```typescript
@Schema()
export class Product {
  // Champ obligatoire avec message d'erreur custom
  @Prop({
    required: [true, 'Le nom du produit est obligatoire'],
    trim: true,
    minlength: [2, 'Le nom doit contenir au moins 2 caracteres'],
    maxlength: [200, 'Le nom ne peut pas depasser 200 caracteres'],
  })
  name: string;

  // Enum avec valeurs autorisees
  @Prop({
    type: String,
    enum: {
      values: ['draft', 'published', 'archived'],
      message: 'Le statut {VALUE} n\'est pas valide',
    },
    default: 'draft',
  })
  status: string;

  // Champ unique avec index
  @Prop({ unique: true, lowercase: true, trim: true })
  sku: string;

  // Nombre avec min/max
  @Prop({
    required: true,
    min: [0, 'Le prix ne peut pas etre negatif'],
    max: [999999.99, 'Le prix est trop eleve'],
  })
  price: number;

  // Validation custom
  @Prop({
    validate: {
      validator: (v: string) => /^[A-Z]{2}-\d{4}$/.test(v),
      message: 'Le code doit etre au format XX-0000',
    },
  })
  productCode: string;

  // Tableau de sous-documents
  @Prop({
    type: [{
      author: { type: String, required: true },
      rating: { type: Number, min: 1, max: 5, required: true },
      comment: { type: String, maxlength: 1000 },
      date: { type: Date, default: Date.now },
    }],
    default: [],
  })
  reviews: Array<{
    author: string;
    rating: number;
    comment?: string;
    date?: Date;
  }>;

  // Objet imbrique (embedded document)
  @Prop({
    type: {
      width: { type: Number, required: true },
      height: { type: Number, required: true },
      depth: { type: Number, required: true },
      weight: { type: Number, required: true },
      unit: { type: String, enum: ['cm', 'in'], default: 'cm' },
    },
  })
  dimensions: {
    width: number;
    height: number;
    depth: number;
    weight: number;
    unit: string;
  };

  // Map (dictionnaire dynamique)
  @Prop({ type: Map, of: String })
  metadata: Map<string, string>;
}
```

### 4.3 Schema complet — Category

```typescript
// schemas/category.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true, versionKey: false })
export class Category {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
```

### 4.4 Schema complet — Order avec sous-documents

```typescript
// schemas/order.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ _id: false }) // Sous-schema sans _id propre
class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;
}

const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ timestamps: true, versionKey: false })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  customer: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ required: true, min: 0 })
  total: number;

  @Prop({
    type: String,
    enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  })
  status: string;

  @Prop({
    type: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    required: true,
  })
  shippingAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

export const OrderSchema = SchemaFactory.createForClass(Order);
```

### 4.5 Enregistrer les schemas dans un module

```typescript
// products/products.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './schemas/product.schema';
import { Category, CategorySchema } from './schemas/category.schema';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

### 4.6 Hooks (middleware Mongoose)

```typescript
const ProductSchema = SchemaFactory.createForClass(Product);

// Pre-save : normaliser le nom
ProductSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Post-save : logger
ProductSchema.post('save', function (doc) {
  console.log(`Product saved: ${doc._id}`);
});

// Pre-find : exclure les archives par defaut
ProductSchema.pre('find', function () {
  this.where({ status: { $ne: 'archived' } });
});
```

### 4.7 Virtuals — Champs calcules

```typescript
ProductSchema.virtual('displayPrice').get(function () {
  return `${this.price.toFixed(2)} EUR`;
});

ProductSchema.virtual('isInStock').get(function () {
  return this.stock > 0;
});

// Virtual populate : tous les avis lies a ce produit
ProductSchema.virtual('reviewsList', {
  ref: 'Review',           // Collection a joindre
  localField: '_id',       // Champ local
  foreignField: 'product', // Champ dans Review qui reference Product
});
```

---

## 5. Operations CRUD

### 5.1 Injecter le Model

Pour interagir avec MongoDB, on injecte le **Model** Mongoose via `@InjectModel` :

```typescript
// products.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}
}
```

### 5.2 Create — Creer un document

```typescript
async create(createProductDto: CreateProductDto): Promise<Product> {
  const product = new this.productModel(createProductDto);
  return product.save();
}

// Alternative plus concise
async create(createProductDto: CreateProductDto): Promise<Product> {
  return this.productModel.create(createProductDto);
}

// Creer plusieurs documents d'un coup
async createMany(products: CreateProductDto[]): Promise<Product[]> {
  return this.productModel.insertMany(products);
}
```

### 5.3 Read — Lire des documents

```typescript
// Trouver tous les documents
async findAll(): Promise<Product[]> {
  return this.productModel.find().exec();
}

// Trouver avec filtres
async findActive(): Promise<Product[]> {
  return this.productModel
    .find({ isActive: true })
    .sort({ createdAt: -1 })
    .exec();
}

// Trouver par ID
async findById(id: string): Promise<Product> {
  const product = await this.productModel.findById(id).exec();
  if (!product) {
    throw new NotFoundException(`Produit avec l'ID ${id} non trouve`);
  }
  return product;
}

// Trouver un seul document
async findBySku(sku: string): Promise<Product | null> {
  return this.productModel.findOne({ sku }).exec();
}

// Pagination
async findPaginated(page: number = 1, limit: number = 10): Promise<{
  data: Product[];
  total: number;
  page: number;
  lastPage: number;
}> {
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    this.productModel
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    this.productModel.countDocuments({ isActive: true }).exec(),
  ]);

  return {
    data,
    total,
    page,
    lastPage: Math.ceil(total / limit),
  };
}

// Recherche textuelle
async search(query: string): Promise<Product[]> {
  return this.productModel
    .find({ $text: { $search: query } })
    .sort({ score: { $meta: 'textScore' } })
    .exec();
}

// Filtres avances avec operateurs
async findByPriceRange(min: number, max: number): Promise<Product[]> {
  return this.productModel
    .find({
      price: { $gte: min, $lte: max },
      isActive: true,
    })
    .exec();
}
```

> **Piege classique** : N'oublie pas `.exec()` a la fin de tes requetes Mongoose. Sans `.exec()`, Mongoose retourne un "thenable" qui fonctionne avec `await`, mais ce n'est pas une vraie Promise. Avec `.exec()`, tu obtiens une vraie Promise avec un meilleur stack trace en cas d'erreur.

### 5.4 lean() — Documents legers

Par defaut, Mongoose retourne des **documents hydrates** (avec des methodes comme `.save()`, `.toObject()`, etc.). Si tu as juste besoin des donnees (pour une API par exemple), utilise `lean()` :

```typescript
// Sans lean() — retourne un document Mongoose complet (~2x plus lent)
const product = await this.productModel.findById(id).exec();
// product.save() fonctionne
// product instanceof mongoose.Document → true

// Avec lean() — retourne un plain object JavaScript (~2x plus rapide)
const product = await this.productModel.findById(id).lean().exec();
// product.save() → TypeError! Ce n'est pas un document Mongoose
// C'est un simple objet { _id, name, price, ... }
```

> **Bonne pratique** : Utilise `lean()` pour toutes les requetes de lecture (GET) ou tu n'as pas besoin de modifier le document ensuite. C'est significativement plus rapide et consomme moins de memoire.

### 5.5 Update — Mettre a jour un document

```typescript
// Mettre a jour et retourner le document modifie
async update(id: string, updateDto: UpdateProductDto): Promise<Product> {
  const product = await this.productModel
    .findByIdAndUpdate(id, { $set: updateDto }, {
      new: true,           // Retourne le document APRES modification
      runValidators: true, // Execute les validations du schema
    })
    .exec();

  if (!product) {
    throw new NotFoundException(`Produit avec l'ID ${id} non trouve`);
  }
  return product;
}

// Mettre a jour un seul champ atomiquement
async updateStock(id: string, quantity: number): Promise<Product> {
  return this.productModel
    .findByIdAndUpdate(
      id,
      { $inc: { stock: -quantity } }, // Decremente le stock
      { new: true, runValidators: true },
    )
    .exec();
}

// Mettre a jour plusieurs documents
async deactivateOutOfStock(): Promise<number> {
  const result = await this.productModel
    .updateMany(
      { stock: 0 },
      { $set: { isActive: false } },
    )
    .exec();
  return result.modifiedCount;
}

// Ajouter un element a un tableau (sans doublons)
async addTag(id: string, tag: string): Promise<Product> {
  return this.productModel
    .findByIdAndUpdate(
      id,
      { $addToSet: { tags: tag } }, // $addToSet evite les doublons
      { new: true },
    )
    .exec();
}

// Retirer un element d'un tableau
async removeTag(id: string, tag: string): Promise<Product> {
  return this.productModel
    .findByIdAndUpdate(
      id,
      { $pull: { tags: tag } },
      { new: true },
    )
    .exec();
}
```

> **Piege classique** : Par defaut, `findByIdAndUpdate` ne retourne PAS le document mis a jour — il retourne le document AVANT modification. Il faut toujours passer `{ new: true }`. De plus, `findByIdAndUpdate` ne declenche PAS les validations du schema par defaut — il faut ajouter `{ runValidators: true }`.

### 5.6 Delete — Supprimer un document

```typescript
// Supprimer par ID
async remove(id: string): Promise<Product> {
  const product = await this.productModel.findByIdAndDelete(id).exec();
  if (!product) {
    throw new NotFoundException(`Produit avec l'ID ${id} non trouve`);
  }
  return product;
}

// Soft delete (recommande en production)
async softDelete(id: string): Promise<Product> {
  return this.productModel
    .findByIdAndUpdate(
      id,
      { $set: { isActive: false, deletedAt: new Date() } },
      { new: true },
    )
    .exec();
}

// Supprimer plusieurs documents
async removeByCategory(categoryId: string): Promise<number> {
  const result = await this.productModel
    .deleteMany({ category: categoryId })
    .exec();
  return result.deletedCount;
}
```

### 5.7 Controller CRUD complet

```typescript
// products.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.productsService.findPaginated(page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
```

### 5.8 DTOs avec class-validator

```typescript
// create-product.dto.ts
import {
  IsString, IsNumber, IsOptional, IsArray,
  Min, MaxLength, IsEnum, IsMongoId,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsMongoId()
  @IsOptional()
  category?: string;
}
```

```typescript
// update-product.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

---

## 6. Relations — Embedding vs Referencing

### 6.1 Deux strategies

MongoDB offre deux approches pour gerer les relations entre donnees :

```
  Embedding (imbrication)                  Referencing (reference)
  ┌─────────────────────────┐              ┌─────────────────────────┐
  │ Order                   │              │ Order                   │
  │ ├── _id                 │              │ ├── _id                 │
  │ ├── customer: {         │              │ ├── customer: ObjectId ──┼──┐
  │ │     name: "Jean",     │              │ ├── items: [...]        │  │
  │ │     email: "j@m.com"  │              │ └── total: 150          │  │
  │ │   }                   │              └─────────────────────────┘  │
  │ ├── items: [...]        │                                          │
  │ └── total: 150          │              ┌─────────────────────────┐  │
  └─────────────────────────┘              │ User                   │  │
                                           │ ├── _id ←──────────────┼──┘
  1 requete pour tout lire                 │ ├── name: "Jean"       │
  Donnees dupliquees                       │ └── email: "j@m.com"   │
  Pas de mise a jour en cascade            └─────────────────────────┘
                                           2 requetes (ou populate)
                                           Pas de duplication
                                           Mise a jour centralisee
```

### 6.2 Quand utiliser quoi ?

```
┌─────────────────────────────────┬──────────────────────────────────┐
│  Embedding (imbrication)         │  Referencing (reference)          │
├─────────────────────────────────┼──────────────────────────────────┤
│  Relation 1:1 ou 1:peu          │  Relation 1:beaucoup             │
│  Donnees lues ensemble           │  Donnees lues independamment     │
│  Donnees rarement modifiees      │  Donnees frequemment modifiees   │
│  Taille < 16 MB par document     │  Documents potentiellement gros  │
│  Ex: adresse dans une commande   │  Ex: produit dans une categorie  │
│  Ex: specs d'un produit          │  Ex: auteur d'un article         │
└─────────────────────────────────┴──────────────────────────────────┘
```

> **Regle d'or** : Imbrique ce qui est toujours lu ensemble. Reference ce qui est lu independamment ou qui est partage entre plusieurs documents.

### 6.3 Embedding — Exemple

```typescript
@Schema()
export class Product {
  @Prop()
  name: string;

  // Reviews embarquees dans le produit
  @Prop({
    type: [{
      user: String,
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      date: { type: Date, default: Date.now },
    }],
    default: [],
  })
  reviews: Array<{
    user: string;
    rating: number;
    comment: string;
    date: Date;
  }>;
}
```

**Avantages** : une seule requete, pas de JOIN, atomique.
**Inconvenients** : duplication, limite de 16 MB par document, pas de requetes independantes.

### 6.4 Referencing — Exemple

```typescript
// category.schema.ts
@Schema()
export class Category {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop()
  description: string;
}

// product.schema.ts
@Schema()
export class Product {
  @Prop()
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  category: Types.ObjectId;
}
```

### 6.5 populate() — Resoudre les references

```typescript
// Charger le produit avec sa categorie
const product = await this.productModel
  .findById(id)
  .populate('category')        // Remplace l'ObjectId par le document complet
  .exec();

// populate selectif (seulement le champ name)
const product = await this.productModel
  .findById(id)
  .populate('category', 'name')
  .exec();

// populate multiple
const product = await this.productModel
  .findById(id)
  .populate('category')
  .populate('seller')
  .exec();

// populate imbrique (nested populate)
const order = await this.orderModel
  .findById(id)
  .populate({
    path: 'items.product',
    select: 'name price',
    populate: {
      path: 'category',
      select: 'name',
    },
  })
  .exec();
```

> **Attention performance** : `populate()` effectue des requetes supplementaires a MongoDB (l'equivalent d'un JOIN cote application). Pour des listes de documents, c'est le probleme N+1. Pour des requetes frequentes sur de gros volumes, prefere l'aggregation `$lookup` ou l'embedding.

---

## 7. Indexes et performance

### 7.1 Pourquoi les index sont importants

Sans index, MongoDB effectue un **collection scan** — il parcourt TOUS les documents pour trouver ceux qui correspondent a ta requete. Avec un index, MongoDB utilise une structure en arbre (B-tree) pour trouver directement les bons documents.

```
  Sans index (collection scan)           Avec index (index scan)
  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐       ┌───────────────┐
  │ 1 │→│ 2 │→│ 3 │→│...│→│ N │       │   B-tree      │
  └───┘ └───┘ └───┘ └───┘ └───┘       │  ┌───┐        │
  Parcourt N documents                  │  │ M │        │
  O(N) — lent sur gros volumes         │ ┌┴─┬─┴┐      │
                                        │ │A │ │Z│      │
                                        │ └──┘ └──┘     │
                                        └───────────────┘
                                        O(log N) — rapide
```

### 7.2 Creer des indexes avec @nestjs/mongoose

```typescript
@Schema()
export class Product {
  @Prop({ index: true }) // Index simple
  name: string;

  @Prop({ unique: true }) // Unique cree aussi un index
  sku: string;

  @Prop()
  price: number;

  @Prop()
  category: Types.ObjectId;
}

const ProductSchema = SchemaFactory.createForClass(Product);

// Index compose (le plus important pour les performances)
ProductSchema.index({ category: 1, price: -1 }); // 1 = ascendant, -1 = descendant

// Index text pour la recherche textuelle
ProductSchema.index({ name: 'text', description: 'text' });

// Index TTL (suppression automatique apres un delai)
ProductSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index partiel (indexe seulement certains documents)
ProductSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $exists: true } } },
);
```

### 7.3 Types d'indexes

```
┌──────────────┬──────────────────────────────────────┬────────────────────────────────┐
│  Type        │  Usage                               │  Exemple                       │
├──────────────┼──────────────────────────────────────┼────────────────────────────────┤
│  Simple      │  Tri, filtre sur un champ            │  { price: 1 }                  │
│  Compose     │  Filtre multi-champs                 │  { category: 1, price: -1 }    │
│  Texte       │  Recherche full-text                 │  { name: 'text' }              │
│  TTL         │  Expiration automatique              │  { createdAt: 1 }, 86400s      │
│  Unique      │  Contrainte d'unicite                │  { email: 1 }, unique          │
│  Partiel     │  Index conditionnel                  │  partialFilterExpression       │
│  Geospatial  │  Requetes geographiques              │  { location: '2dsphere' }      │
└──────────────┴──────────────────────────────────────┴────────────────────────────────┘
```

### 7.4 La regle ESR — Concevoir des index composes

La regle **ESR** (Equality, Sort, Range) aide a concevoir des index composes efficaces :

```
  E — Equality  : champs avec egalite stricte (category = "electronics")
  S — Sort      : champs utilises pour le tri (sort by price)
  R — Range     : champs avec range (price > 10 AND price < 100)

  Ordre optimal dans l'index : E, S, R

  Exemple de requete :
    find({ category: "electronics", isActive: true })
      .sort({ price: -1 })
      .where('price').gte(10).lte(1000)

  Index optimal :
    { category: 1, isActive: 1, price: -1 }
      E             E            S+R
```

### 7.5 explain() — Analyser les performances

```typescript
// Dans un service (debug uniquement)
const explanation = await this.productModel
  .find({ category: 'someId', isActive: true })
  .sort({ price: -1 })
  .explain('executionStats');

console.log(JSON.stringify(explanation, null, 2));
```

```
  explain() — Ce qu'il faut regarder :

  ┌────────────────────────┬──────────────────────────────────────┐
  │  Champ                 │  Signification                       │
  ├────────────────────────┼──────────────────────────────────────┤
  │  winningPlan.stage     │  IXSCAN = bon, COLLSCAN = mauvais   │
  │  totalDocsExamined     │  Nombre de documents scannes         │
  │  nReturned             │  Nombre de documents retournes       │
  │  executionTimeMillis   │  Temps d'execution en ms             │
  │  totalKeysExamined     │  Nombre de cles d'index examinees    │
  └────────────────────────┴──────────────────────────────────────┘

  Ideal : totalDocsExamined = nReturned (l'index est bien utilise)
  Mauvais : totalDocsExamined >> nReturned (collection scan partiel)
```

> **Attention** : Un index non utilise consomme de la memoire et ralentit les ecritures. Surveillez vos indexes avec `db.collection.getIndexes()` et supprimez ceux qui ne sont pas utilises.

---

## 8. Aggregation Pipeline

### 8.1 Qu'est-ce que l'aggregation ?

L'aggregation pipeline est le systeme de traitement de donnees de MongoDB. C'est l'equivalent des requetes `GROUP BY`, `HAVING`, `JOIN` en SQL, mais en plus puissant et flexible.

```
  Donnees d'entree
       │
       ▼
  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │  $match  │ ──→ │  $group  │ ──→ │  $sort   │ ──→ │ $project │
  │ (filtre) │     │ (agrege) │     │  (tri)   │     │ (forme)  │
  └──────────┘     └──────────┘     └──────────┘     └──────────┘
       │
  "WHERE"          "GROUP BY"       "ORDER BY"       "SELECT"
```

### 8.2 Les stages principaux

```
┌──────────────┬───────────────────────────────────────────────┐
│  Etape       │  Description                                  │
├──────────────┼───────────────────────────────────────────────┤
│  $match      │  Filtre les documents (comme find())          │
│  $group      │  Regroupe et agrege ($sum, $avg, $min, $max)  │
│  $sort       │  Trie les resultats                           │
│  $limit      │  Limite le nombre de resultats                │
│  $skip       │  Saute N resultats (pagination)               │
│  $project    │  Selectionne/transforme les champs            │
│  $lookup     │  Jointure avec une autre collection           │
│  $unwind     │  Decompresse un tableau en documents          │
│  $addFields  │  Ajoute des champs calcules                   │
│  $facet      │  Branches paralleles dans le pipeline         │
│  $bucket     │  Regroupe par plages                          │
└──────────────┴───────────────────────────────────────────────┘
```

### 8.3 $match — Filtrer les documents

```typescript
// Equivalent de WHERE en SQL
async getActiveProducts(): Promise<Product[]> {
  return this.productModel.aggregate([
    { $match: { isActive: true, stock: { $gt: 0 } } },
  ]);
}
```

### 8.4 $group — Agreger les donnees

```typescript
// Equivalent de GROUP BY en SQL
async getStatsByCategory(): Promise<any[]> {
  return this.productModel.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$category',                    // Groupe par categorie
        totalProducts: { $sum: 1 },          // COUNT(*)
        averagePrice: { $avg: '$price' },    // AVG(price)
        maxPrice: { $max: '$price' },        // MAX(price)
        minPrice: { $min: '$price' },        // MIN(price)
        totalStock: { $sum: '$stock' },      // SUM(stock)
      },
    },
    { $sort: { totalProducts: -1 } },        // ORDER BY totalProducts DESC
  ]);
}
```

### 8.5 $lookup — Joindre des collections

```typescript
// Equivalent de LEFT JOIN en SQL
async getProductsWithCategory(): Promise<any[]> {
  return this.productModel.aggregate([
    {
      $lookup: {
        from: 'categories',          // Collection a joindre
        localField: 'category',      // Champ dans products
        foreignField: '_id',         // Champ dans categories
        as: 'categoryDetails',       // Nom du champ resultat
      },
    },
    { $unwind: '$categoryDetails' }, // Transforme le tableau en objet
    {
      $project: {
        name: 1,
        price: 1,
        categoryName: '$categoryDetails.name',
      },
    },
  ]);
}
```

### 8.6 $project — Transformer la sortie

```typescript
{
  $project: {
    _id: 0,                          // Exclure _id
    categoryName: '$_id',            // Renommer _id
    totalProducts: 1,                // Inclure tel quel
    averagePrice: { $round: ['$averagePrice', 2] }, // Arrondir
    priceRange: {                    // Champ calcule
      $subtract: ['$maxPrice', '$minPrice'],
    },
  },
}
```

### 8.7 Exemple complet — Dashboard e-commerce

```typescript
async getDashboardStats(): Promise<{
  totalRevenue: number;
  topCategories: any[];
  priceDistribution: any[];
}> {
  // Statistiques par categorie
  const topCategories = await this.productModel.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$category',
        productCount: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        totalStockValue: {
          $sum: { $multiply: ['$price', '$stock'] },
        },
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: '$category' },
    {
      $project: {
        _id: 0,
        categoryName: '$category.name',
        productCount: 1,
        avgPrice: { $round: ['$avgPrice', 2] },
        totalStockValue: { $round: ['$totalStockValue', 2] },
      },
    },
    { $sort: { totalStockValue: -1 } },
    { $limit: 5 },
  ]);

  // Distribution des prix par tranche
  const priceDistribution = await this.productModel.aggregate([
    { $match: { isActive: true } },
    {
      $bucket: {
        groupBy: '$price',
        boundaries: [0, 10, 50, 100, 500, 1000, Infinity],
        default: 'other',
        output: {
          count: { $sum: 1 },
          avgPrice: { $avg: '$price' },
        },
      },
    },
  ]);

  // Revenu potentiel total
  const [revenue] = await this.productModel.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalRevenue: {
          $sum: { $multiply: ['$price', '$stock'] },
        },
      },
    },
  ]);

  return {
    totalRevenue: revenue?.totalRevenue ?? 0,
    topCategories,
    priceDistribution,
  };
}
```

### 8.8 $facet — Plusieurs aggregations en une requete

```typescript
async getProductOverview(): Promise<any> {
  const [result] = await this.productModel.aggregate([
    { $match: { isActive: true } },
    {
      $facet: {
        // Pipeline 1 : stats globales
        stats: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              avgPrice: { $avg: '$price' },
              totalStock: { $sum: '$stock' },
            },
          },
        ],
        // Pipeline 2 : top 5 plus chers
        topExpensive: [
          { $sort: { price: -1 } },
          { $limit: 5 },
          { $project: { name: 1, price: 1 } },
        ],
        // Pipeline 3 : bientot en rupture
        lowStock: [
          { $match: { stock: { $lte: 5, $gt: 0 } } },
          { $sort: { stock: 1 } },
          { $project: { name: 1, stock: 1 } },
        ],
      },
    },
  ]);

  return result;
}
```

---

## 9. Transactions

### 9.1 Pourquoi les transactions ?

Les transactions garantissent que plusieurs operations sont executees de maniere **atomique** — soit toutes reussissent, soit aucune n'est appliquee. C'est indispensable pour des operations comme une commande e-commerce (debit stock + creation commande).

> **Prerequis** : Les transactions MongoDB necessitent un **replica set** (meme en developpement avec un seul noeud) :
> ```bash
> docker run -d -p 27017:27017 --name mongodb mongo:7 --replSet rs0
> docker exec mongodb mongosh --eval "rs.initiate()"
> ```

### 9.2 Implementation avec try/catch/finally

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { Order, OrderDocument } from './schemas/order.schema';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto): Promise<Order> {
    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      // 1. Verifier et decrementer le stock pour chaque produit
      for (const item of createOrderDto.items) {
        const product = await this.productModel
          .findOneAndUpdate(
            {
              _id: item.productId,
              stock: { $gte: item.quantity },
            },
            { $inc: { stock: -item.quantity } },
            { new: true, session },
          )
          .exec();

        if (!product) {
          throw new BadRequestException(
            `Stock insuffisant pour le produit ${item.productId}`,
          );
        }
      }

      // 2. Creer la commande
      const [order] = await this.orderModel.create(
        [{
          customer: createOrderDto.customerId,
          items: createOrderDto.items,
          total: createOrderDto.total,
          status: 'confirmed',
        }],
        { session },
      );

      // 3. Commit — toutes les operations sont appliquees
      await session.commitTransaction();
      return order;
    } catch (error) {
      // En cas d'erreur, annuler toutes les operations
      await session.abortTransaction();
      throw error;
    } finally {
      // Toujours fermer la session
      session.endSession();
    }
  }
}
```

### 9.3 Transaction avec withTransaction()

Mongoose propose aussi une API simplifiee qui gere automatiquement le commit/abort :

```typescript
async createOrder(createOrderDto: CreateOrderDto): Promise<Order> {
  const session = await this.connection.startSession();
  let order: Order;

  await session.withTransaction(async () => {
    for (const item of createOrderDto.items) {
      const product = await this.productModel
        .findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true, session },
        )
        .exec();

      if (!product) {
        throw new BadRequestException(`Stock insuffisant`);
      }
    }

    const [created] = await this.orderModel.create(
      [{
        customer: createOrderDto.customerId,
        items: createOrderDto.items,
        total: createOrderDto.total,
      }],
      { session },
    );
    order = created;
  });

  session.endSession();
  return order;
}
```

> **Bonne pratique** : Les transactions ajoutent de la latence (~5-10ms de plus par operation). N'utilise pas de transaction quand une seule operation atomique suffit (ex: `findOneAndUpdate` est deja atomique au niveau du document).

---

## 10. MongoDB vs PostgreSQL — Matrice de decision

### 10.1 Quand choisir quoi ?

```
┌──────────────────────────┬────────────┬────────────┐
│  Critere                 │  MongoDB   │ PostgreSQL │
├──────────────────────────┼────────────┼────────────┤
│  Schema flexible         │  ⭐⭐⭐⭐⭐   │  ⭐⭐        │
│  Relations complexes     │  ⭐⭐        │  ⭐⭐⭐⭐⭐   │
│  Scalabilite horizontale │  ⭐⭐⭐⭐⭐   │  ⭐⭐        │
│  Transactions ACID       │  ⭐⭐⭐      │  ⭐⭐⭐⭐⭐   │
│  Performances lecture    │  ⭐⭐⭐⭐⭐   │  ⭐⭐⭐⭐     │
│  Performances ecriture   │  ⭐⭐⭐⭐     │  ⭐⭐⭐⭐     │
│  Aggregation/Analytics   │  ⭐⭐⭐⭐     │  ⭐⭐⭐⭐⭐   │
│  Geospatial              │  ⭐⭐⭐⭐⭐   │  ⭐⭐⭐⭐     │
│  Full-text search        │  ⭐⭐⭐      │  ⭐⭐⭐⭐     │
│  Courbe d'apprentissage  │  ⭐⭐⭐⭐     │  ⭐⭐⭐      │
│  Ecosysteme NestJS       │  ⭐⭐⭐⭐     │  ⭐⭐⭐⭐⭐   │
│  Outils de migration     │  ⭐⭐⭐      │  ⭐⭐⭐⭐⭐   │
└──────────────────────────┴────────────┴────────────┘
```

### 10.2 Par scenario

```
┌─────────────────────────────┬───────────────┬──────────────────────────────────┐
│  Scenario                   │  Choix        │  Raison                          │
├─────────────────────────────┼───────────────┼──────────────────────────────────┤
│  Catalogue e-commerce       │  MongoDB      │  Attributs variables par categorie│
│  Commandes et paiements     │  PostgreSQL   │  Transactions ACID, integrite     │
│  CMS / blog                 │  MongoDB      │  Structure flexible, embedding    │
│  Application financiere     │  PostgreSQL   │  ACID strict, precision numerique │
│  IoT / logs                 │  MongoDB      │  Volume, schema flexible          │
│  Profils utilisateur        │  MongoDB      │  Documents riches, lecture rapide  │
│  Reporting / BI             │  PostgreSQL   │  SQL, JOINs, fenetres analytiques │
│  Gestion de stock           │  PostgreSQL   │  Transactions, contraintes        │
│  Configuration / settings   │  MongoDB      │  Documents imbriques naturels     │
└─────────────────────────────┴───────────────┴──────────────────────────────────┘
```

### 10.3 Approche hybride (Polyglot Persistence)

Beaucoup d'applications modernes utilisent les deux :

```
  ┌───────────────────────────────────────────────────────┐
  │                     Application NestJS                 │
  │                                                        │
  │  ┌──────────────────┐     ┌──────────────────────┐   │
  │  │   PostgreSQL      │     │    MongoDB            │   │
  │  │                   │     │                       │   │
  │  │  • Users          │     │  • Product catalog    │   │
  │  │  • Orders         │     │  • User sessions      │   │
  │  │  • Payments       │     │  • Logs & events      │   │
  │  │  • Accounting     │     │  • CMS content        │   │
  │  │                   │     │  • Search index        │   │
  │  └──────────────────┘     └──────────────────────┘   │
  │     Relations strictes        Donnees flexibles        │
  │     ACID complet              Lecture rapide            │
  └───────────────────────────────────────────────────────┘
```

```typescript
// Coexistence dans NestJS
@Module({
  imports: [
    TypeOrmModule.forRoot({ /* config PostgreSQL */ }),
    MongooseModule.forRoot('mongodb://localhost:27017/catalog'),
    OrdersModule,    // utilise TypeORM
    ProductsModule,  // utilise Mongoose
  ],
})
export class AppModule {}
```

---

## 11. Migration depuis TypeORM/Prisma vers Mongoose

### 11.1 Mapping des concepts

```
┌─────────────────────────────┬────────────────────────────────────────────┐
│  TypeORM / Prisma           │  Mongoose                                  │
├─────────────────────────────┼────────────────────────────────────────────┤
│  @Entity()                  │  @Schema()                                 │
│  @Column()                  │  @Prop()                                   │
│  @PrimaryGeneratedColumn()  │  _id (automatique, ObjectId)               │
│  @ManyToOne                 │  @Prop({ type: Types.ObjectId, ref: '...' })│
│  @OneToMany                 │  Virtual populate ou embedding             │
│  Repository<T>              │  Model<T> via @InjectModel()               │
│  repository.find()          │  model.find()                              │
│  repository.save(entity)    │  new model(data).save()                    │
│  QueryBuilder               │  Aggregation Pipeline                      │
│  Migrations                 │  Pas necessaire (schema flexible)          │
└─────────────────────────────┴────────────────────────────────────────────┘
```

### 11.2 Exemple concret — TypeORM vers Mongoose

```typescript
// ═══════════════════════════════════════════
// TypeORM — Entity
// ═══════════════════════════════════════════
@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  name: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @ManyToOne(() => Category, (cat) => cat.products)
  category: Category;

  @CreateDateColumn()
  createdAt: Date;
}

// ═══════════════════════════════════════════
// Mongoose — Schema (equivalent)
// ═══════════════════════════════════════════
@Schema({ timestamps: true, versionKey: false })
export class Product {
  // _id est auto-genere (ObjectId au lieu d'un entier auto-increment)

  @Prop({ required: true, maxlength: 200 })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  category: Types.ObjectId;

  // createdAt et updatedAt geres par timestamps: true
}
```

### 11.3 Exemple concret — Prisma vers Mongoose

```typescript
// ═══════════════════════════════════════════
// Prisma — Schema (schema.prisma)
// ═══════════════════════════════════════════
// model Product {
//   id          Int       @id @default(autoincrement())
//   name        String    @db.VarChar(200)
//   price       Decimal
//   stock       Int       @default(0)
//   category    Category  @relation(fields: [categoryId], references: [id])
//   categoryId  Int
//   tags        String[]
//   createdAt   DateTime  @default(now())
//   updatedAt   DateTime  @updatedAt
// }

// Prisma usage:
// await prisma.product.findMany({
//   where: { price: { gte: 10, lte: 100 } },
//   include: { category: true },
//   orderBy: { price: 'desc' },
// });

// ═══════════════════════════════════════════
// Mongoose — Equivalent
// ═══════════════════════════════════════════
@Schema({ timestamps: true, versionKey: false })
export class Product {
  @Prop({ required: true, maxlength: 200 })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 0 })
  stock: number;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  category: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags: string[];
}

// Mongoose usage (equivalent):
// await this.productModel
//   .find({ price: { $gte: 10, $lte: 100 } })
//   .populate('category')
//   .sort({ price: -1 })
//   .exec();
```

### 11.4 Guide de migration pas a pas

```
  Etape 1 : Analyser le schema existant
  ├── Identifier les entites et leurs relations
  ├── Decider embedding vs referencing pour chaque relation
  └── Planifier la migration des donnees

  Etape 2 : Creer les schemas Mongoose
  ├── Convertir les Entity/model en classes @Schema
  ├── Mapper les types (int → number, varchar → string, etc.)
  └── Configurer les index

  Etape 3 : Migrer les services
  ├── Remplacer le Repository par le Model Mongoose
  ├── Adapter les methodes find/save/update/delete
  └── Convertir les JOINs en populate() ou $lookup

  Etape 4 : Migrer les donnees
  ├── Exporter les donnees SQL en JSON
  ├── Transformer les cles etrangeres en ObjectId
  └── Importer dans MongoDB avec mongoimport ou scripts

  Etape 5 : Tests et validation
  ├── Verifier toutes les operations CRUD
  ├── Tester les performances avec explain()
  └── Valider l'integrite des donnees
```

---

## 12. Bonnes pratiques et patterns avances

### 12.1 Schema Design Patterns

#### Pattern attribut (champs variables)

```typescript
// Au lieu de colonnes NULL pour chaque attribut possible
// Utilise un tableau d'attributs
@Schema({ timestamps: true, versionKey: false })
export class Product {
  @Prop({ required: true })
  name: string;

  @Prop({
    type: [{
      key: { type: String, required: true },
      value: { type: String, required: true },
      unit: String,
    }],
    default: [],
  })
  attributes: Array<{
    key: string;
    value: string;
    unit?: string;
  }>;
}

// Usage :
// { name: "MacBook", attributes: [
//   { key: "screen", value: "16", unit: "inches" },
//   { key: "ram", value: "18", unit: "GB" },
// ]}
// { name: "T-shirt", attributes: [
//   { key: "fabric", value: "cotton" },
//   { key: "size", value: "M" },
// ]}
```

#### Pattern bucket (time-series)

```typescript
// Regroupe les mesures dans des buckets au lieu d'un document par mesure
@Schema({ versionKey: false })
export class SensorBucket {
  @Prop({ required: true })
  sensorId: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ type: [{ timestamp: Date, value: Number }] })
  measurements: Array<{ timestamp: Date; value: number }>;

  @Prop({ default: 0 })
  count: number;

  @Prop()
  sum: number;

  @Prop()
  avg: number;
}
```

### 12.2 Gestion des erreurs Mongoose

```typescript
import { ConflictException, BadRequestException } from '@nestjs/common';
import { MongoServerError } from 'mongodb';

async create(dto: CreateProductDto): Promise<Product> {
  try {
    return await this.productModel.create(dto);
  } catch (error) {
    // Erreur de duplication (index unique)
    if (error instanceof MongoServerError && error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      throw new ConflictException(
        `Un produit avec ce ${field} existe deja`,
      );
    }
    // Erreur de validation Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors)
        .map((err: any) => err.message);
      throw new BadRequestException(messages);
    }
    throw error;
  }
}
```

### 12.3 Tests avec mongodb-memory-server

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

let mongod: MongoMemoryServer;

// Avant les tests
mongod = await MongoMemoryServer.create();
const uri = mongod.getUri();

const module = await Test.createTestingModule({
  imports: [
    MongooseModule.forRoot(uri),
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
}).compile();

// Apres les tests
await mongod.stop();
```

### 12.4 Securite — Eviter les injections MongoDB

```typescript
// Sanitize les query params pour eviter les injections d'operateurs
function sanitizeQuery(input: any): any {
  if (typeof input === 'object' && input !== null) {
    for (const key of Object.keys(input)) {
      if (key.startsWith('$')) {
        delete input[key];
      }
    }
  }
  return input;
}
```

---

## 13. Operations en masse (Bulk)

### 13.1 Pourquoi les operations en masse ?

Quand tu dois inserer, mettre a jour ou supprimer des milliers de documents, envoyer une requete par document est extremement lent. Les operations en masse regroupent plusieurs operations dans un seul aller-retour vers MongoDB.

```
  Approche naive (N requetes)          Approche bulk (1 requete)
  ┌───┐  ┌───┐  ┌───┐                ┌─────────────────────────┐
  │ 1 │→ │ 2 │→ │...│→ N requetes    │  bulkWrite([op1, op2,   │
  └───┘  └───┘  └───┘                │   ..., opN])            │
  N allers-retours reseau             └─────────────────────────┘
  ~500ms pour 1000 docs               1 aller-retour reseau
                                       ~20ms pour 1000 docs
```

### 13.2 insertMany() — Insertion par lots

```typescript
// Inserer plusieurs documents en une seule operation
async importProducts(products: CreateProductDto[]): Promise<Product[]> {
  // ordered: false → continue meme si un document echoue
  return this.productModel.insertMany(products, { ordered: false });
}
```

> **`ordered: false`** : Par defaut, `insertMany()` s'arrete a la premiere erreur. Avec `ordered: false`, MongoDB continue l'insertion des documents restants et collecte toutes les erreurs a la fin. Indispensable pour les imports de donnees ou certains doublons sont attendus.

### 13.3 bulkWrite() — Operations mixtes

`bulkWrite()` permet de combiner des insertions, mises a jour et suppressions dans un seul appel :

```typescript
async importProducts(products: CreateProductDto[]): Promise<BulkWriteResult> {
  const operations = products.map(p => ({
    insertOne: { document: p },
  }));
  return this.productModel.bulkWrite(operations, { ordered: false });
}
```

```typescript
// Exemple avance : mix d'operations differentes
async syncCatalog(changes: CatalogChange[]): Promise<BulkWriteResult> {
  const operations = changes.map(change => {
    switch (change.type) {
      case 'create':
        return { insertOne: { document: change.data } };
      case 'update':
        return {
          updateOne: {
            filter: { _id: change.id },
            update: { $set: change.data },
          },
        };
      case 'delete':
        return { deleteOne: { filter: { _id: change.id } } };
    }
  });

  return this.productModel.bulkWrite(operations, { ordered: false });
}
```

### 13.4 Taille de batch optimale

Pour de tres gros volumes (100k+ documents), decoupe en batches pour eviter de saturer la memoire :

```typescript
async bulkImport(products: CreateProductDto[]): Promise<number> {
  const BATCH_SIZE = 2000; // 1000-5000 docs par batch est optimal
  let totalInserted = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const result = await this.productModel.insertMany(batch, {
      ordered: false,
    });
    totalInserted += result.length;
  }

  return totalInserted;
}
```

### 13.5 Gestion des erreurs partielles

Avec `ordered: false`, certains documents peuvent echouer alors que d'autres reussissent. Il faut gerer ces erreurs partielles :

```typescript
import { MongoServerError } from 'mongodb';

async safeImport(products: CreateProductDto[]): Promise<{
  inserted: number;
  errors: string[];
}> {
  try {
    const result = await this.productModel.insertMany(products, {
      ordered: false,
    });
    return { inserted: result.length, errors: [] };
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      // BulkWriteError : certains documents ont ete inseres
      const insertedCount = (error as any).result?.insertedCount ?? 0;
      const writeErrors = (error as any).writeErrors ?? [];
      const errorMessages = writeErrors.map(
        (e: any) => `Index ${e.index}: ${e.errmsg}`,
      );
      return { inserted: insertedCount, errors: errorMessages };
    }
    throw error;
  }
}
```

> **Conseil performance** : Pour les imports massifs, desactive temporairement les index non essentiels, importe les donnees, puis recree les index. C'est beaucoup plus rapide que d'indexer a chaque insertion.

---

## 14. Change Streams : temps reel

### 14.1 Qu'est-ce qu'un Change Stream ?

Les Change Streams permettent d'ecouter en temps reel les modifications d'une collection MongoDB. Chaque insertion, mise a jour ou suppression declenche un evenement. C'est l'equivalent d'un trigger SQL, mais cote application.

```
  ┌──────────────────┐     change event      ┌──────────────────┐
  │   Client HTTP     │ ──── POST /products ──→│   NestJS API      │
  └──────────────────┘                        │                   │
                                               │  productModel     │
                                               │    .create(dto)   │
                                               └────────┬──────────┘
                                                        │ insert
                                                        ▼
                                               ┌──────────────────┐
                                               │    MongoDB        │
                                               │  (replica set)    │
                                               └────────┬──────────┘
                                                        │ change event
                                                        ▼
                                               ┌──────────────────┐
                                               │  Change Stream    │
                                               │  Watcher          │──→ WebSocket
                                               └──────────────────┘     → Dashboard
```

> **Prerequis** : Les Change Streams necessitent un **replica set** (meme en developpement avec un seul noeud) :
> ```bash
> docker run -d -p 27017:27017 --name mongodb mongo:7 --replSet rs0
> docker exec mongodb mongosh --eval "rs.initiate()"
> ```

### 14.2 Integration NestJS avec WebSocket Gateway

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ChangeStream } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { ProductGateway } from './product.gateway';

@Injectable()
export class ProductWatcher implements OnModuleInit, OnModuleDestroy {
  private changeStream: ChangeStream;

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly gateway: ProductGateway,
  ) {}

  onModuleInit() {
    this.changeStream = this.productModel.watch();

    this.changeStream.on('change', (change) => {
      switch (change.operationType) {
        case 'insert':
          this.gateway.server.emit('product:created', change.fullDocument);
          break;
        case 'update':
          this.gateway.server.emit('product:updated', {
            id: change.documentKey._id,
            changes: change.updateDescription?.updatedFields,
          });
          break;
        case 'delete':
          this.gateway.server.emit('product:deleted', {
            id: change.documentKey._id,
          });
          break;
      }
    });
  }

  onModuleDestroy() {
    if (this.changeStream) {
      this.changeStream.close();
    }
  }
}
```

### 14.3 Filtrage des evenements

Tu peux filtrer les evenements pour ne recevoir que ceux qui t'interessent :

```typescript
// Ecouter uniquement les insertions et mises a jour de prix
const pipeline = [
  {
    $match: {
      $or: [
        { operationType: 'insert' },
        { 'updateDescription.updatedFields.price': { $exists: true } },
      ],
    },
  },
];

this.changeStream = this.productModel.watch(pipeline);
```

### 14.4 Resumabilite — Reprendre apres une deconnexion

Chaque evenement contient un `resumeToken`. En cas de deconnexion, tu peux reprendre la ou tu t'etais arrete :

```typescript
private lastResumeToken: any;

onModuleInit() {
  const options = this.lastResumeToken
    ? { resumeAfter: this.lastResumeToken }
    : {};

  this.changeStream = this.productModel.watch([], options);

  this.changeStream.on('change', (change) => {
    this.lastResumeToken = change._id; // Sauvegarder le token
    this.gateway.server.emit('product:change', change);
  });

  this.changeStream.on('error', () => {
    // Reconnecter automatiquement apres un delai
    setTimeout(() => this.onModuleInit(), 5000);
  });
}
```

> **Cas d'usage** : dashboard d'inventaire en temps reel, notifications de changement de prix, synchronisation inter-services dans une architecture microservices.

---

## 15. Tester avec MongoMemoryServer

### 15.1 Pourquoi mongodb-memory-server ?

`mongodb-memory-server` lance une instance MongoDB en memoire, sans Docker ni installation. Chaque suite de tests obtient sa propre base, completement isolee. C'est la reference pour les tests unitaires et d'integration avec Mongoose.

```bash
pnpm add -D mongodb-memory-server
```

### 15.2 Configuration du module de test NestJS

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { Product, ProductSchema } from './schemas/product.schema';

describe('ProductsService', () => {
  let mongod: MongoMemoryServer;
  let module: TestingModule;
  let service: ProductsService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([
          { name: Product.name, schema: ProductSchema },
        ]),
      ],
      providers: [ProductsService],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  afterAll(async () => {
    await module.close();
    await mongod.stop();
  });
});
```

### 15.3 Nettoyage entre les tests

Chaque test doit partir d'un etat propre pour eviter les effets de bord :

```typescript
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';

let productModel: Model<Product>;

beforeAll(async () => {
  // ... setup ci-dessus
  productModel = module.get<Model<Product>>(getModelToken(Product.name));
});

afterEach(async () => {
  // Nettoyer toutes les donnees entre chaque test
  await productModel.deleteMany({});
});
```

### 15.4 Factories de donnees de test

Cree des factories pour generer des donnees de test coherentes et reutilisables :

```typescript
// test/factories/product.factory.ts
import { CreateProductDto } from '../../src/products/dto/create-product.dto';

let counter = 0;

export function buildProduct(
  overrides: Partial<CreateProductDto> = {},
): CreateProductDto {
  counter++;
  return {
    name: `Product ${counter}`,
    price: 29.99,
    stock: 100,
    tags: ['test'],
    ...overrides,
  };
}

// Utilisation dans un test :
it('should create a product', async () => {
  const dto = buildProduct({ name: 'MacBook Pro', price: 2499 });
  const product = await service.create(dto);
  expect(product.name).toBe('MacBook Pro');
  expect(product.price).toBe(2499);
});

it('should find products by price range', async () => {
  await productModel.create([
    buildProduct({ price: 10 }),
    buildProduct({ price: 50 }),
    buildProduct({ price: 200 }),
  ]);

  const results = await service.findByPriceRange(20, 100);
  expect(results).toHaveLength(1);
  expect(results[0].price).toBe(50);
});
```

### 15.5 Configuration Vitest pour MongoDB

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    // Timeout plus long pour le demarrage de MongoMemoryServer
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Execution sequentielle pour eviter les conflits de port
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
  plugins: [swc.vite()],
});
```

### 15.6 Tester les aggregations

```typescript
it('should compute stats by category', async () => {
  const catId = new Types.ObjectId();
  await productModel.create([
    buildProduct({ category: catId, price: 100, stock: 10 }),
    buildProduct({ category: catId, price: 200, stock: 5 }),
  ]);

  const stats = await service.getStatsByCategory();

  expect(stats).toHaveLength(1);
  expect(stats[0].totalProducts).toBe(2);
  expect(stats[0].averagePrice).toBe(150);
  expect(stats[0].totalStock).toBe(15);
});
```

> **Bonne pratique** : Les tests avec `MongoMemoryServer` sont plus lents que des tests unitaires purs (~100-500ms par test). Reserve-les aux couches service et repository. Pour les controllers, prefere des mocks classiques du service.

---

## 16. Recapitulatif

### Ce que tu as appris

```
  ┌─────────────────────────────────────────────────────────────┐
  │  Module 25 — MongoDB & Mongoose — Resume                    │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  1. SQL vs NoSQL : deux paradigmes complementaires          │
  │  2. MongoDB : documents BSON, collections, schema flexible  │
  │  3. @nestjs/mongoose : forRoot, forRootAsync, forFeature    │
  │  4. Schemas : @Schema, @Prop, validation, hooks, virtuals  │
  │  5. CRUD : create, find, findById, update, delete, lean()   │
  │  6. Relations : embedding vs referencing, populate()         │
  │  7. Indexes : simples, composes, text, TTL, regle ESR       │
  │  8. Aggregation : $match, $group, $sort, $lookup, $facet    │
  │  9. Transactions : sessions, startTransaction, atomicite    │
  │ 10. Decision : quand choisir MongoDB vs PostgreSQL          │
  │ 11. Migration : depuis TypeORM/Prisma vers Mongoose         │
  │ 12. Bonnes pratiques : patterns, erreurs, securite          │
  │ 13. Bulk : insertMany, bulkWrite, batches, erreurs partielles│
  │ 14. Change Streams : temps reel, WebSocket, resumabilite    │
  │ 15. Tests : MongoMemoryServer, factories, Vitest            │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

### Commandes utiles

```bash
# Lancer MongoDB avec Docker
docker run -d --name mongodb -p 27017:27017 mongo:7

# Se connecter avec mongosh
docker exec -it mongodb mongosh

# Commandes mongosh utiles
show dbs                          # Lister les bases
use ecommerce                     # Selectionner une base
show collections                  # Lister les collections
db.products.find().pretty()       # Voir tous les documents
db.products.countDocuments()      # Compter les documents
db.products.getIndexes()          # Voir les index
db.products.find().explain()      # Analyser une requete
```

---

## Exercices

Passe au **Lab 25** (`labs/lab-25-mongodb-mongoose/`) pour mettre en pratique :
- Creation de schemas avec validation
- CRUD complet avec pagination
- Aggregation pipeline (stats par categorie)
- Tests E2E avec `mongodb-memory-server`

---

## Ressources

- [Documentation Mongoose](https://mongoosejs.com/docs/guide.html)
- [Documentation @nestjs/mongoose](https://docs.nestjs.com/techniques/mongodb)
- [MongoDB University](https://university.mongodb.com/) — Cours gratuits
- [MongoDB Schema Design Best Practices](https://www.mongodb.com/developer/products/mongodb/schema-design-anti-pattern-massive-arrays/)
- [Aggregation Pipeline Reference](https://www.mongodb.com/docs/manual/reference/operator/aggregation-pipeline/)
