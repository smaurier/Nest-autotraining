# Screencast 25 — MongoDB & Mongoose

## Informations
- **Duree estimee** : 15-20 min
- **Module** : `modules/25-mongodb-mongoose.md`
- **Lab associe** : `labs/lab-25-mongodb-mongoose/`
- **Prerequis** : Screencasts 09-13 (NestJS fondamentaux), 14-17 (ORMs SQL)

## Setup
- [ ] Node.js 20+ installe
- [ ] Docker installe (pour MongoDB)
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Editeur de code ouvert
- [ ] Port 27017 disponible

## Script

### [00:00-02:30] Introduction — Pourquoi MongoDB ?

> Bienvenue dans le module 25. Jusqu'ici, on a travaille exclusivement avec des bases relationnelles : PostgreSQL via TypeORM et Prisma. Aujourd'hui, on decouvre MongoDB — une base de donnees orientee documents. Ce n'est pas un remplacement de PostgreSQL, c'est un outil complementaire pour des cas d'usage specifiques.

**Action** : Afficher le slide "SQL vs NoSQL — Quand choisir quoi ?".

> Voici la regle simple : si vos donnees ont un schema fixe avec beaucoup de relations — utilisez PostgreSQL. Si vos donnees sont heterogenes, hierarchiques ou si le schema change souvent — MongoDB est un excellent choix. Par exemple : un catalogue de produits ou chaque categorie a des attributs differents, des logs d'evenements, des configurations utilisateur.

**Action** : Lancer MongoDB avec Docker.

```bash
docker run -d --name mongo-lab -p 27017:27017 mongo:7
```

> MongoDB tourne. Contrairement a PostgreSQL, pas besoin de definir un schema avant d'inserer des donnees. Mais avec Mongoose, on va quand meme structurer nos donnees — c'est une bonne pratique.

### [02:30-06:00] Schema Mongoose avec NestJS

**Action** : Montrer la definition d'un schema avec les decorateurs NestJS/Mongoose.

```typescript
// src/products/schemas/product.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true })
  category: string;

  @Prop({ default: true })
  inStock: boolean;

  @Prop({ type: [String], default: [] })
  tags: string[];
}

export const ProductSchema = SchemaFactory.createForClass(Product);
```

> Comparez avec TypeORM : au lieu de @Entity et @Column, on utilise @Schema et @Prop. Le concept est le meme : des decorateurs TypeScript qui decrivent la structure. La difference fondamentale, c'est que MongoDB stocke des documents JSON, pas des lignes dans des tables.

> L'option `timestamps: true` ajoute automatiquement createdAt et updatedAt — exactement comme @CreateDateColumn dans TypeORM.

### [06:00-10:00] CRUD avec le Model Mongoose

**Action** : Montrer le module et le service.

```typescript
// src/products/products.module.ts
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
```

```typescript
// src/products/products.service.ts
@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async create(dto: CreateProductDto): Promise<Product> {
    const product = new this.productModel(dto);
    return product.save();
  }

  async findAll(): Promise<Product[]> {
    return this.productModel.find().exec();
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productModel.findById(id).exec();
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.productModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async remove(id: string): Promise<void> {
    const result = await this.productModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(`Product ${id} not found`);
  }
}
```

> Notez les differences avec TypeORM/Prisma : `findById` au lieu de `findOne({ id })`, `findByIdAndUpdate` au lieu de `update` + `find`. Mongoose retourne directement le document ou null — pas besoin de `affected` ou de verifier le resultat.

> L'option `{ new: true }` dans findByIdAndUpdate retourne le document APRES la modification. Sans cette option, vous obtenez l'ancien document — un piege classique.

### [10:00-14:00] Recherche et Aggregation

**Action** : Montrer la recherche par regex.

```typescript
async search(query: string): Promise<Product[]> {
  const regex = new RegExp(query, 'i');
  return this.productModel.find({
    $or: [
      { name: regex },
      { description: regex },
    ],
  }).exec();
}
```

> La recherche par regex est simple mais pas performante sur de gros volumes. Pour la production, utilisez les index texte de MongoDB ou un moteur de recherche comme Elasticsearch.

**Action** : Montrer une aggregation.

```typescript
async statsByCategory(): Promise<any[]> {
  return this.productModel.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}
```

> L'aggregation pipeline de MongoDB est extremement puissante. Chaque stage transforme les donnees. $group est l'equivalent du GROUP BY en SQL, $sort du ORDER BY. Mais le pipeline peut aussi faire $lookup (JOIN), $unwind (decompression de tableaux), $facet (sous-pipelines paralleles).

### [14:00-17:00] Embedding vs Referencing

**Action** : Montrer les deux strategies.

```typescript
// Strategie 1 : Embedding (denormalisation)
@Schema()
class Order {
  @Prop({ type: [{ name: String, price: Number, quantity: Number }] })
  items: { name: string; price: number; quantity: number }[];

  @Prop()
  total: number;
}

// Strategie 2 : Referencing (normalisation)
@Schema()
class Order {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }] })
  items: Types.ObjectId[];
}
```

> Embedding est la strategie par defaut en MongoDB. Si les donnees sont toujours lues ensemble, embeddez-les. Si elles sont partagees entre plusieurs documents ou si elles grandissent sans limite, referencez-les.

> Par exemple, les items d'une commande : on les embed car on veut figer le prix au moment de l'achat, et ils sont toujours lus avec la commande. Les produits du catalogue : on les reference car ils sont partages entre plusieurs commandes.

### [17:00-19:00] Recapitulatif

> MongoDB n'est pas meilleur ou pire que PostgreSQL — c'est un outil different pour des problemes differents. Utilisez PostgreSQL quand vous avez des relations complexes et des transactions ACID critiques. Utilisez MongoDB quand vos donnees sont hierarchiques, heterogenes ou quand le schema evolue souvent.

> Avec @nestjs/mongoose, l'integration dans NestJS est naturelle : memes patterns de modules, services et controllers. Si vous connaissez TypeORM ou Prisma avec NestJS, vous retrouverez vos reperes rapidement.

> Faites le Lab 25 pour implementer un CRUD complet avec recherche et aggregation !

## Points d'attention pour l'enregistrement
- Montrer Docker pour lancer MongoDB — les etudiants n'auront pas forcement MongoDB installe nativement
- Comparer systematiquement avec TypeORM/Prisma pour que les etudiants voient les correspondances
- L'aggregation pipeline est le concept le plus nouveau — prendre le temps d'expliquer chaque stage
- Insister sur le fait que MongoDB et PostgreSQL sont complementaires, pas concurrents
- Le piege `{ new: true }` est un classique — le mentionner clairement
