# Screencast 24 — Projet Final E-commerce

## Informations
- **Duree estimee** : 25-30 min
- **Module** : `modules/24-projet-final.md`
- **Lab associe** : `labs/lab-24-projet-final/`
- **Prerequis** : Tous les screencasts precedents (00-23)

## Setup
- [ ] Node.js 20+ installe
- [ ] Docker et docker-compose installes
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Editeur de code ouvert
- [ ] PostgreSQL et Redis disponibles (via Docker)
- [ ] Port 3000 disponible

## Script

### [00:00-04:00] Introduction — Le projet final

> Salut ! Bienvenue dans le dernier screencast de cette formation. On va assembler tout ce qu'on a appris en construisant une API e-commerce complete : produits, panier, commandes, paiement, auth, et deploiement. C'est la synthese de 24 modules.

**Action** : Afficher le slide de titre "Module 24 — Projet Final E-commerce".

> Voici ce qu'on va construire : une API e-commerce avec la gestion des produits et categories, un systeme d'authentification avec roles (client, vendeur, admin), un panier et un processus de commande, des notifications par email via queues, et le tout dockerise.

**Action** : Montrer l'architecture du projet.

```
e-commerce-api/
  src/
    auth/          # Authentification JWT + RBAC
    users/         # Profils utilisateurs
    products/      # Catalogue produit
    categories/    # Categories de produits
    cart/          # Panier d'achat
    orders/        # Commandes
    payments/      # Simulation de paiement
    notifications/ # Emails via queue
    common/        # Guards, pipes, filters, interceptors
    config/        # Configuration centralisee
    prisma/        # PrismaService
    health/        # Health checks
  prisma/
    schema.prisma  # Schema de la base
  docker-compose.yml
  Dockerfile
```

### [04:00-09:00] Schema Prisma — Le modele de donnees

**Action** : Creer le schema Prisma complet.

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  CLIENT
  SELLER
  ADMIN
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  password  String
  role      Role     @default(CLIENT)
  orders    Order[]
  cart      CartItem[]
  products  Product[]  @relation("SellerProducts")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

model Category {
  id       Int       @id @default(autoincrement())
  name     String    @unique
  slug     String    @unique
  products Product[]

  @@map("categories")
}

model Product {
  id          Int        @id @default(autoincrement())
  name        String
  description String?
  price       Decimal    @db.Decimal(10, 2)
  stock       Int        @default(0)
  imageUrl    String?
  category    Category   @relation(fields: [categoryId], references: [id])
  categoryId  Int
  seller      User       @relation("SellerProducts", fields: [sellerId], references: [id])
  sellerId    Int
  cartItems   CartItem[]
  orderItems  OrderItem[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@map("products")
}

model CartItem {
  id        Int     @id @default(autoincrement())
  user      User    @relation(fields: [userId], references: [id])
  userId    Int
  product   Product @relation(fields: [productId], references: [id])
  productId Int
  quantity  Int     @default(1)

  @@unique([userId, productId])
  @@map("cart_items")
}

model Order {
  id        Int         @id @default(autoincrement())
  user      User        @relation(fields: [userId], references: [id])
  userId    Int
  items     OrderItem[]
  total     Decimal     @db.Decimal(10, 2)
  status    OrderStatus @default(PENDING)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@map("orders")
}

model OrderItem {
  id        Int     @id @default(autoincrement())
  order     Order   @relation(fields: [orderId], references: [id])
  orderId   Int
  product   Product @relation(fields: [productId], references: [id])
  productId Int
  quantity  Int
  price     Decimal @db.Decimal(10, 2)

  @@map("order_items")
}
```

> Le schema modelise une vraie application e-commerce. Les roles definissent qui peut faire quoi. Les produits appartiennent a des vendeurs et des categories. Le panier est lie a l'utilisateur. Les commandes figent le prix au moment de l'achat.

**Action** : Appliquer le schema.

```bash
npx prisma migrate dev --name init-ecommerce
npx prisma generate
```

### [09:00-14:00] Modules metier — Produits et commandes

**Action** : Montrer le service produits.

```typescript
// src/products/products.service.ts
@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto, sellerId: number) {
    return this.prisma.product.create({
      data: { ...dto, sellerId },
      include: { category: true, seller: { select: { id: true, name: true } } },
    });
  }

  async findAll(filters: { categoryId?: number; minPrice?: number; maxPrice?: number; search?: string; page?: number; limit?: number }) {
    const where: any = {};

    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice;
      if (filters.maxPrice) where.price.lte = filters.maxPrice;
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }
}
```

**Action** : Montrer le service de commandes avec transaction.

```typescript
// src/orders/orders.service.ts
@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('notifications') private notifQueue: Queue,
  ) {}

  async createFromCart(userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Recuperer le panier
      const cartItems = await tx.cartItem.findMany({
        where: { userId },
        include: { product: true },
      });

      if (cartItems.length === 0) {
        throw new BadRequestException('Le panier est vide');
      }

      // 2. Verifier le stock
      for (const item of cartItems) {
        if (item.product.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour ${item.product.name}`,
          );
        }
      }

      // 3. Calculer le total
      const total = cartItems.reduce(
        (sum, item) => sum + Number(item.product.price) * item.quantity, 0,
      );

      // 4. Creer la commande
      const order = await tx.order.create({
        data: {
          userId,
          total,
          items: {
            create: cartItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.price,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      // 5. Decrementer le stock
      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // 6. Vider le panier
      await tx.cartItem.deleteMany({ where: { userId } });

      // 7. Envoyer une notification
      await this.notifQueue.add('order-confirmation', {
        userId,
        orderId: order.id,
        total,
      });

      return order;
    });
  }
}
```

> La creation de commande est une transaction : elle verifie le stock, cree la commande, decremente le stock, vide le panier, et envoie une notification. Si une etape echoue, tout est annule.

### [14:00-18:00] Auth, Guards et Swagger

**Action** : Montrer les controllers avec auth et Swagger.

```typescript
// src/products/products.controller.ts
@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lister les produits avec filtres' })
  findAll(
    @Query('category') categoryId?: number,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.findAll({ categoryId, minPrice, maxPrice, search, page, limit });
  }

  @Post()
  @Roles('SELLER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Creer un produit (vendeur/admin)' })
  create(@Body() dto: CreateProductDto, @CurrentUser('id') sellerId: number) {
    return this.productsService.create(dto, sellerId);
  }
}

// src/orders/orders.controller.ts
@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Creer une commande a partir du panier' })
  checkout(@CurrentUser('id') userId: number) {
    return this.ordersService.createFromCart(userId);
  }

  @Get('my-orders')
  @ApiOperation({ summary: 'Mes commandes' })
  getMyOrders(@CurrentUser('id') userId: number) {
    return this.ordersService.findByUser(userId);
  }
}
```

**Action** : Tester le flux complet.

```bash
# 1. S'inscrire
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@shop.com","password":"password123"}' \
  http://localhost:3000/auth/register

# 2. Se connecter
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"alice@shop.com","password":"password123"}' \
  http://localhost:3000/auth/login

# 3. Parcourir les produits
curl "http://localhost:3000/products?search=laptop&maxPrice=1500"

# 4. Ajouter au panier
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"productId":1,"quantity":2}' \
  http://localhost:3000/cart

# 5. Passer la commande
curl -X POST -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/orders/checkout
```

### [18:00-22:00] Docker et deploiement final

**Action** : Lancer toute l'application avec docker-compose.

```bash
docker-compose up -d
docker-compose ps
```

**Action** : Montrer Swagger UI avec toutes les routes.

```bash
# Ouvrir http://localhost:3000/api/docs
```

> Swagger affiche toutes les routes de l'API : auth, produits, panier, commandes. Chaque route est documentee avec ses parametres, ses codes de reponse, et ses schemas. Un developpeur frontend peut integrer l'API sans lire le code backend.

**Action** : Verifier la sante de l'application.

```bash
curl http://localhost:3000/health | jq
```

### [22:00-26:00] Retrospective — Ce qu'on a appris

> Prenons du recul. En 25 modules, on a parcouru tout le chemin du backend Node.js.

**Action** : Afficher le slide retrospective.

> On a commence par les fondamentaux : l'event loop, les modules, les streams. On a construit un serveur HTTP from scratch pour comprendre les bases. Puis Express pour simplifier. Validation, erreurs, authentification.

> Ensuite NestJS : controllers, providers, modules, pipes, guards, interceptors. Deux ORMs : TypeORM et Prisma. Le testing. L'auth avancee avec Passport. Config et Swagger pour la production. WebSockets pour le temps reel. Queues pour le traitement asynchrone. Et finalement, Docker pour le deploiement.

> Ce projet e-commerce utilise tout ca. C'est une API de production complete, pas un exemple jouet.

### [26:00-28:00] Recap final

> Felicitations si vous etes arrives jusqu'ici ! Vous avez les competences pour construire des APIs backend professionnelles avec Node.js et NestJS. Le code du projet final est dans `labs/lab-24-projet-final/`. Clonez-le, explorez-le, modifiez-le.

**Action** : Afficher le slide de conclusion.

> Quelques pistes pour aller plus loin : GraphQL avec NestJS, les microservices, le serverless, le monitoring avec Prometheus et Grafana. Le backend est un monde vaste — cette formation vous a donne les fondations solides pour l'explorer. Merci et bonne continuation !

## Points d'attention pour l'enregistrement
- C'est le screencast le plus long — prevoir des pauses si necessaire
- Le flux complet (register -> login -> browse -> cart -> checkout) doit fonctionner du premier coup
- Swagger doit etre impressionnant avec toutes les routes documentees
- Terminer sur une note positive et encourageante — c'est la fin de la formation
- Avoir des donnees de seed pour que le catalogue de produits ne soit pas vide
