# Module 24 — Projet Final — API E-commerce complete

> **Objectif** : Mettre en pratique TOUS les concepts appris dans les modules 1 a 23 en construisant une API e-commerce complete, de la conception au déploiement, en passant par l'authentification, le CRUD, les WebSockets, les taches planifiees et les tests.
> **Difficulte** : ⭐⭐⭐⭐⭐ (expert)
> **Prérequis** : Tous les modules précédents (1 a 23)
> **Duree estimee** : 15-20 heures

---

## 1. Vue d'ensemble du projet

### 1.1 Description

Vous allez construire **ShopNest**, une API REST complète pour une plateforme e-commerce. Cette API géré les utilisateurs, les produits, les categories, le panier, les commandes et les notifications en temps réel.

### 1.2 Fonctionnalites principales

| Fonctionnalite | Modules utilises |
|----------------|-----------------|
| Authentification JWT + RBAC | Module 19 |
| CRUD Produits + Categories | Modules 10-12, 14-17 |
| Panier d'achat | Modules 14-17 |
| Commandes transactionnelles | Module 15 ou 17 |
| Notifications temps réel | Module 21 |
| Tache de nettoyage des paniers abandonnes | Module 22 |
| Validation avancee des DTOs | Module 13 |
| Documentation Swagger | Module 20 |
| Tests unitaires + E2E | Module 18 |
| Docker Compose | Module 23 |
| Cache + Rate Limiting | Module 23 |

### 1.3 Architecture du projet

```
shopnest-api/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   └── pagination/
│   ├── config/
│   │   ├── database.config.ts
│   │   ├── jwt.config.ts
│   │   └── redis.config.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   ├── guards/
│   │   ├── decorators/
│   │   └── dto/
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── dto/
│   ├── categories/
│   │   ├── categories.module.ts
│   │   ├── categories.controller.ts
│   │   ├── categories.service.ts
│   │   └── dto/
│   ├── products/
│   │   ├── products.module.ts
│   │   ├── products.controller.ts
│   │   ├── products.service.ts
│   │   └── dto/
│   ├── cart/
│   │   ├── cart.module.ts
│   │   ├── cart.controller.ts
│   │   ├── cart.service.ts
│   │   └── dto/
│   ├── orders/
│   │   ├── orders.module.ts
│   │   ├── orders.controller.ts
│   │   ├── orders.service.ts
│   │   └── dto/
│   ├── notifications/
│   │   ├── notifications.module.ts
│   │   ├── notifications.gateway.ts
│   │   └── notifications.service.ts
│   ├── tasks/
│   │   ├── tasks.module.ts
│   │   └── tasks.service.ts
│   └── health/
│       ├── health.module.ts
│       └── health.controller.ts
├── test/
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
├── .env
├── .env.example
├── jest.config.js
├── nest-cli.json
├── tsconfig.json
└── package.json
```

---

## 2. Schema de la base de donnees

### 2.1 Diagramme des tables

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│    users      │      │  categories   │      │    products    │
├──────────────┤      ├──────────────┤      ├──────────────┤
│ id (PK)       │      │ id (PK)       │      │ id (PK)        │
│ email         │      │ nom           │      │ nom            │
│ nom           │      │ slug          │      │ slug           │
│ motDePasse    │      │ description   │      │ description    │
│ role (enum)   │      │ image         │      │ prix           │
│ actif         │      │ actif         │      │ stock          │
│ refreshToken  │      │ createdAt     │      │ images (json)  │
│ createdAt     │      │ updatedAt     │      │ actif          │
│ updatedAt     │      └──────┬───────┘      │ categoryId(FK) │
└──────┬───────┘             │              │ createdAt      │
       │                     │              │ updatedAt      │
       │                     └──────────────┤                │
       │                                    └──────┬─────────┘
       │                                           │
┌──────┴───────┐      ┌──────────────┐     ┌──────┴─────────┐
│  cart_items   │      │    orders     │     │  order_items    │
├──────────────┤      ├──────────────┤     ├──────────────┤
│ id (PK)       │      │ id (PK)       │     │ id (PK)         │
│ userId (FK)   │      │ userId (FK)   │     │ orderId (FK)    │
│ productId(FK) │      │ statut(enum)  │     │ productId (FK)  │
│ quantite      │      │ total         │     │ quantite        │
│ createdAt     │      │ adresse(json) │     │ prixUnitaire    │
│ updatedAt     │      │ createdAt     │     │ createdAt       │
└──────────────┘      │ updatedAt     │     └────────────────┘
                      └──────────────┘
```

### 2.2 Schema Prisma complet

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// === Enums ===

enum Role {
  ADMIN
  CUSTOMER
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}

// === Modeles ===

model User {
  id           Int       @id @default(autoincrement())
  email        String    @unique
  nom          String    @db.VarChar(100)
  motDePasse   String    @map("mot_de_passe")
  role         Role      @default(CUSTOMER)
  actif        Boolean   @default(true)
  refreshToken String?   @map("refresh_token")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  cartItems    CartItem[]
  orders       Order[]

  @@map("users")
}

model Category {
  id          Int       @id @default(autoincrement())
  nom         String    @db.VarChar(100)
  slug        String    @unique
  description String?   @db.Text
  image       String?
  actif       Boolean   @default(true)
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  products    Product[]

  @@map("categories")
}

model Product {
  id          Int       @id @default(autoincrement())
  nom         String    @db.VarChar(200)
  slug        String    @unique
  description String?   @db.Text
  prix        Decimal   @db.Decimal(10, 2)
  stock       Int       @default(0)
  images      Json      @default("[]")
  actif       Boolean   @default(true)
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  category    Category  @relation(fields: [categoryId], references: [id])
  categoryId  Int       @map("category_id")

  cartItems   CartItem[]
  orderItems  OrderItem[]

  @@index([slug])
  @@index([categoryId])
  @@index([prix])
  @@map("products")
}

model CartItem {
  id         Int      @id @default(autoincrement())
  quantite   Int      @default(1)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId     Int      @map("user_id")

  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId  Int      @map("product_id")

  @@unique([userId, productId])
  @@map("cart_items")
}

model Order {
  id         Int         @id @default(autoincrement())
  statut     OrderStatus @default(PENDING)
  total      Decimal     @db.Decimal(10, 2)
  adresse    Json
  createdAt  DateTime    @default(now()) @map("created_at")
  updatedAt  DateTime    @updatedAt @map("updated_at")

  user       User        @relation(fields: [userId], references: [id])
  userId     Int         @map("user_id")

  items      OrderItem[]

  @@index([userId])
  @@index([statut])
  @@map("orders")
}

model OrderItem {
  id           Int     @id @default(autoincrement())
  quantite     Int
  prixUnitaire Decimal @db.Decimal(10, 2) @map("prix_unitaire")

  order        Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId      Int     @map("order_id")

  product      Product @relation(fields: [productId], references: [id])
  productId    Int     @map("product_id")

  @@map("order_items")
}
```

---

## 3. Implementation étape par étape

### Étape 1 : Initialisation du projet

```bash
# Creer le projet NestJS
nest new shopnest-api
cd shopnest-api

# Installer les dependances
npm install @nestjs/config @nestjs/cache-manager cache-manager
npm install @nestjs/passport passport passport-local passport-jwt @nestjs/jwt
npm install @nestjs/swagger
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install @nestjs/schedule
npm install @nestjs/bull bull
npm install @nestjs/throttler
npm install @nestjs/terminus
npm install @prisma/client
npm install bcrypt class-validator class-transformer
npm install joi compression helmet
npm install nestjs-pino pino-http pino pino-pretty

npm install --save-dev prisma
npm install --save-dev @types/passport-local @types/passport-jwt @types/bcrypt @types/multer

# Initialiser Prisma
npx prisma init --datasource-provider postgresql
```

### Étape 2 : Configuration (app.module.ts)

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';

// Modules metier
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TasksModule } from './tasks/tasks.module';
import { HealthModule } from './health/health.module';

// Guards
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    // Configuration avec validation
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
      }),
    }),

    // Cache
    CacheModule.register({ isGlobal: true, ttl: 60 }),

    // Rate limiting
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 5 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),

    // Taches planifiees
    ScheduleModule.forRoot(),

    // Files d'attente (Bull + Redis)
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),

    // Modules metier
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    NotificationsModule,
    TasksModule,
    HealthModule,
  ],
  providers: [
    // Guards globaux
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

### Étape 3 : main.ts complet

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Securite
  app.use(helmet());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: nodeEnv === 'production'
      ? ['https://shopnest.com']
      : ['http://localhost:4200', 'http://localhost:3001'],
    credentials: true,
  });

  // Validation globale
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Prefix global de l'API
  app.setGlobalPrefix('api/v1');

  // Swagger (sauf en production)
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('ShopNest API')
      .setDescription('API E-commerce complete — Projet final du cours NestJS')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentification')
      .addTag('users', 'Gestion des utilisateurs')
      .addTag('categories', 'Gestion des categories')
      .addTag('products', 'Catalogue produits')
      .addTag('cart', 'Panier d\'achat')
      .addTag('orders', 'Commandes')
      .addTag('health', 'Sante de l\'application')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`ShopNest API lancee sur le port ${port} (env: ${nodeEnv})`);
  if (nodeEnv !== 'production') {
    console.log(`Swagger : http://localhost:${port}/api/docs`);
  }
}
bootstrap();
```

### Étape 4 : ProductsService (CRUD complet)

```typescript
// src/products/products.service.ts
import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async create(dto: CreateProductDto) {
    const slug = this.generateSlug(dto.nom);

    const product = await this.prisma.product.create({
      data: {
        nom: dto.nom,
        slug,
        description: dto.description,
        prix: dto.prix,
        stock: dto.stock || 0,
        images: dto.images || [],
        categoryId: dto.categoryId,
      },
      include: { category: true },
    });

    // Invalider le cache des listes
    await this.invalidateListCache();

    return product;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    categoryId?: number;
    search?: string;
    minPrix?: number;
    maxPrix?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }) {
    const {
      page = 1,
      limit = 10,
      categoryId,
      search,
      minPrix,
      maxPrix,
      sort = 'createdAt',
      order = 'desc',
    } = params;

    // Construire les conditions de filtre
    const where: Prisma.ProductWhereInput = {
      actif: true,
      ...(categoryId ? { categoryId } : {}),
      ...(search
        ? {
            OR: [
              { nom: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(minPrix || maxPrix
        ? {
            prix: {
              ...(minPrix ? { gte: minPrix } : {}),
              ...(maxPrix ? { lte: maxPrix } : {}),
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, nom: true, slug: true } },
        },
        orderBy: { [sort]: order },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: number) {
    const cacheKey = `product:${id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Produit #${id} introuvable`);
    }

    await this.cache.set(cacheKey, product, 300);
    return product;
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException(`Produit "${slug}" introuvable`);
    }

    return product;
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);

    const data: any = { ...dto };
    if (dto.nom) {
      data.slug = this.generateSlug(dto.nom);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    });

    await this.cache.del(`product:${id}`);
    await this.invalidateListCache();

    return updated;
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.product.update({
      where: { id },
      data: { actif: false },
    });

    await this.cache.del(`product:${id}`);
    await this.invalidateListCache();

    return { message: `Produit #${id} desactive` };
  }

  private generateSlug(nom: string): string {
    return nom
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async invalidateListCache() {
    // En production avec Redis, on utiliserait des patterns
    // Pour le cache memoire, on supprime les cles connues
  }
}
```

### Étape 5 : OrdersService (transactionnel)

```typescript
// src/orders/orders.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateOrderDto } from './dto/create-order.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsGateway,
  ) {}

  async createFromCart(userId: number, dto: CreateOrderDto) {
    // Transaction interactive pour garantir l'integrite
    return this.prisma.$transaction(async (tx) => {
      // 1. Recuperer les articles du panier
      const cartItems = await tx.cartItem.findMany({
        where: { userId },
        include: { product: true },
      });

      if (cartItems.length === 0) {
        throw new BadRequestException('Le panier est vide');
      }

      // 2. Verifier le stock de chaque produit
      let total = new Prisma.Decimal(0);

      for (const item of cartItems) {
        if (!item.product.actif) {
          throw new BadRequestException(
            `Le produit "${item.product.nom}" n'est plus disponible`,
          );
        }

        if (item.product.stock < item.quantite) {
          throw new BadRequestException(
            `Stock insuffisant pour "${item.product.nom}". ` +
            `Disponible: ${item.product.stock}, Demande: ${item.quantite}`,
          );
        }

        total = total.add(
          new Prisma.Decimal(item.product.prix.toString()).mul(item.quantite),
        );
      }

      // 3. Creer la commande
      const order = await tx.order.create({
        data: {
          userId,
          statut: 'PENDING',
          total,
          adresse: dto.adresse,
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              quantite: item.quantite,
              prixUnitaire: item.product.prix,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, nom: true, slug: true } },
            },
          },
        },
      });

      // 4. Decrementer les stocks
      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantite } },
        });
      }

      // 5. Vider le panier
      await tx.cartItem.deleteMany({ where: { userId } });

      // 6. Notification temps reel
      this.notifications.notifyUser(userId, 'orderCreated', {
        orderId: order.id,
        total: order.total,
        message: `Votre commande #${order.id} a ete confirmee !`,
      });

      // Notifier les admins
      this.notifications.notifyAdmins('newOrder', {
        orderId: order.id,
        userId,
        total: order.total,
      });

      return order;
    });
  }

  async findAllForUser(userId: number, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: {
          items: {
            include: {
              product: { select: { id: true, nom: true, slug: true, images: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, userId?: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, nom: true, email: true } },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Commande #${id} introuvable`);
    }

    // Un client ne peut voir que ses propres commandes
    if (userId && order.userId !== userId) {
      throw new NotFoundException(`Commande #${id} introuvable`);
    }

    return order;
  }

  async updateStatus(id: number, statut: string) {
    const order = await this.findOne(id);

    const updated = await this.prisma.order.update({
      where: { id },
      data: { statut: statut as any },
      include: { items: { include: { product: true } } },
    });

    // Notification au client
    this.notifications.notifyUser(order.userId, 'orderStatusUpdate', {
      orderId: id,
      oldStatut: order.statut,
      newStatut: statut,
      message: `Votre commande #${id} est maintenant "${statut}"`,
    });

    return updated;
  }

  // Annuler une commande (remet le stock)
  async cancel(id: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!order || order.userId !== userId) {
        throw new NotFoundException(`Commande #${id} introuvable`);
      }

      if (order.statut !== 'PENDING') {
        throw new BadRequestException(
          'Seules les commandes en attente peuvent etre annulees',
        );
      }

      // Remettre le stock
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantite } },
        });
      }

      // Mettre a jour le statut
      return tx.order.update({
        where: { id },
        data: { statut: 'CANCELLED' },
      });
    });
  }
}
```

### Étape 6 : Tache de nettoyage des paniers abandonnes

```typescript
// src/tasks/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger('TasksService');

  constructor(private readonly prisma: PrismaService) {}

  // Nettoyer les paniers abandonnes (plus de 7 jours)
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanAbandonedCarts() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await this.prisma.cartItem.deleteMany({
      where: {
        updatedAt: { lt: sevenDaysAgo },
      },
    });

    this.logger.log(
      `Nettoyage des paniers abandonnes : ${result.count} article(s) supprime(s)`,
    );
  }

  // Verifier les commandes en attente depuis plus de 24h
  @Cron(CronExpression.EVERY_HOUR)
  async checkPendingOrders() {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const pendingOrders = await this.prisma.order.findMany({
      where: {
        statut: 'PENDING',
        createdAt: { lt: oneDayAgo },
      },
      select: { id: true, userId: true },
    });

    if (pendingOrders.length > 0) {
      this.logger.warn(
        `${pendingOrders.length} commande(s) en attente depuis plus de 24h`,
      );
    }
  }

  // Statistiques quotidiennes
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async dailyStats() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [newUsers, newOrders, revenue] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: { gte: yesterday, lt: today } },
      }),
      this.prisma.order.count({
        where: { createdAt: { gte: yesterday, lt: today } },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: {
          createdAt: { gte: yesterday, lt: today },
          statut: { not: 'CANCELLED' },
        },
      }),
    ]);

    this.logger.log(
      `Statistiques du ${yesterday.toISOString().split('T')[0]} : ` +
      `${newUsers} nouveaux utilisateurs, ` +
      `${newOrders} commandes, ` +
      `${revenue._sum.total || 0} EUR de chiffre d'affaires`,
    );
  }
}
```

### Étape 7 : NotificationsGateway (WebSocket)

```typescript
// src/notifications/notifications.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/notifications' })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('NotificationsGateway');
  private connectedUsers = new Map<number, string[]>(); // userId → socketIds

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
      });

      const userId = payload.sub;
      client.data.userId = userId;
      client.data.role = payload.role;

      // Enregistrer la connexion
      const existing = this.connectedUsers.get(userId) || [];
      existing.push(client.id);
      this.connectedUsers.set(userId, existing);

      // Les admins rejoignent la room admin
      if (payload.role === 'ADMIN') {
        client.join('admin-room');
      }

      // Chaque utilisateur a sa propre room
      client.join(`user-${userId}`);

      this.logger.log(`Utilisateur #${userId} connecte (${client.id})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const connections = this.connectedUsers.get(userId) || [];
      const remaining = connections.filter((id) => id !== client.id);

      if (remaining.length === 0) {
        this.connectedUsers.delete(userId);
      } else {
        this.connectedUsers.set(userId, remaining);
      }
    }
  }

  // Envoyer a un utilisateur specifique
  notifyUser(userId: number, event: string, data: any) {
    this.server.to(`user-${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  // Envoyer a tous les admins
  notifyAdmins(event: string, data: any) {
    this.server.to('admin-room').emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  // Broadcast a tous
  broadcast(event: string, data: any) {
    this.server.emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## 4. Stratégie de tests

### 4.1 Tests unitaires

Testez chaque service avec des mocks :
- `ProductsService` : toutes les méthodes CRUD
- `OrdersService` : création transactionnelle, annulation
- `CartService` : ajout, modification, suppression
- `AuthService` : login, register, refresh, logout

### 4.2 Tests E2E

```typescript
// test/products.e2e-spec.ts (extrait)
describe('Products E2E', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    // ... setup de l'app et login admin
  });

  describe('GET /api/v1/products', () => {
    it('devrait lister les produits sans authentification', () => {
      return request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.meta).toBeDefined();
          expect(res.body.meta.total).toBeGreaterThanOrEqual(0);
        });
    });

    it('devrait filtrer par categorie', () => {
      return request(app.getHttpServer())
        .get('/api/v1/products?categoryId=1')
        .expect(200);
    });

    it('devrait chercher par terme', () => {
      return request(app.getHttpServer())
        .get('/api/v1/products?search=clavier')
        .expect(200);
    });
  });

  describe('POST /api/v1/products', () => {
    it('devrait creer un produit (admin)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nom: 'Clavier mecanique',
          description: 'Clavier gaming RGB',
          prix: 89.99,
          stock: 50,
          categoryId: 1,
        })
        .expect(201);
    });

    it('devrait refuser sans authentification (401)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/products')
        .send({ nom: 'Test' })
        .expect(401);
    });
  });
});
```

---

## 5. Docker Compose complet

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - '3000:3000'
    env_file: .env
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/shopnest
      - REDIS_HOST=redis
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: shopnest
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

---

## 6. Guide de lancement

```bash
# 1. Cloner et installer
git clone <repo>
cd shopnest-api
npm install

# 2. Configurer l'environnement
cp .env.example .env
# Editer .env avec vos valeurs

# 3. Lancer les services (Docker)
docker compose up -d postgres redis

# 4. Creer la base et appliquer les migrations
npx prisma migrate dev --name init

# 5. Peupler avec des donnees de test
npx prisma db seed

# 6. Lancer l'application
npm run start:dev

# 7. Acceder a la documentation
# http://localhost:3000/api/docs

# 8. Lancer les tests
npm run test
npm run test:e2e
npm run test:cov
```

---

## 7. Criteres d'évaluation

| Critere | Points | Description |
|---------|--------|-------------|
| Schema de base fonctionnel | /10 | Toutes les tables et relations correctes |
| Authentification JWT + RBAC | /15 | Login, register, refresh, roles |
| CRUD Produits + Categories | /15 | Toutes les operations avec validation |
| Panier d'achat | /10 | Ajout, modification, suppression |
| Commandes transactionnelles | /15 | Integrite des donnees, gestion du stock |
| WebSocket notifications | /10 | Temps réel fonctionnel |
| Tache planifiee | /5 | Nettoyage des paniers abandonnes |
| Tests (unitaires + E2E) | /10 | Couverture > 70% |
| Documentation Swagger | /5 | Complete et a jour |
| Docker Compose | /5 | Les 3 services fonctionnent |

---

## 8. Extensions possibles (bonus)

Pour aller plus loin après le projet de base :

- **Système de wishlist** : les utilisateurs peuvent sauvegarder des produits
- **Système d'avis** : notes et commentaires sur les produits
- **Recherche full-text** : avec PostgreSQL tsvector ou Elasticsearch
- **Upload d'images** : avec Multer + stockage cloud (S3)
- **Emails transactionnels** : confirmation de commande via Bull queue
- **Système de coupons** : codes promo avec pourcentage ou montant fixe
- **Historique de prix** : tracking des changements de prix
- **Export CSV/PDF** : des commandes et rapports de ventes
- **Webhook** : notification vers des services externes
- **GraphQL** : ajouter une couche GraphQL en parallele de REST

---

## 9. Exercices pratiques

### Exercice 1 : Implementation du panier

Implementez le `CartService` complet avec :
1. `addToCart(userId, productId, quantite)` — vérifié le stock
2. `updateQuantity(userId, productId, quantite)`
3. `removeFromCart(userId, productId)`
4. `getCart(userId)` — retourne le panier avec les prix calcules
5. `clearCart(userId)`

### Exercice 2 : Administration

Creez un `AdminController` avec :
1. `GET /admin/dashboard` — statistiques (nombre d'utilisateurs, commandes, CA)
2. `GET /admin/orders` — toutes les commandes avec filtres
3. `PATCH /admin/orders/:id/status` — changer le statut d'une commande
4. `GET /admin/users` — liste des utilisateurs avec pagination

### Exercice 3 : Tests complets

Ecrivez :
1. Tests unitaires pour `OrdersService` (création, annulation)
2. Tests E2E pour le flux complet : inscription → login → ajout au panier → commande
3. Atteignez une couverture de tests > 80%

---

## Liens

| Ressource | Lien |
|-----------|------|
| Quiz Module 24 | `quiz/24-quiz.md` |
| Lab Module 24 | `labs/24-lab-projet-final.md` |
| Screencast | `screencasts/24-screencast.md` |
| Module précédent | [Module 23 — Performance & Déploiement](23-performance-deploiement.md) |
| Premier module | [Module 1 — Introduction](01-introduction.md) |
| NestJS Documentation | https://docs.nestjs.com/ |
| Prisma Documentation | https://www.prisma.io/docs |
| Docker Documentation | https://docs.docker.com/ |
| GitHub du projet | A définir par le formateur |

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 24 projet final](../screencasts/screencast-24-projet-final.md)
2. **Lab** : [lab-24-projet-final](../labs/lab-24-projet-final/README)
3. **Quiz** : [quiz 24 projet final](../quizzes/quiz-24-projet-final.html)
:::
