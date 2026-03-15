# Module 11 — NestJS — Providers & Injection de Dependances

> **Objectif** : Comprendre en profondeur l'injection de dépendances (DI) de NestJS, maîtriser les différents types de providers (useClass, useValue, useFactory, useExisting), les scopes, les tokens d'injection, et comprendre pourquoi la DI est essentielle pour les applications maintenables et testables.
>
> **Difficulte** : ⭐⭐⭐ (avance)

---

## 1. Qu'est-ce que l'Injection de Dependances

### 1.1 Le problème sans DI

Sans injection de dépendances, chaque classe créé elle-même ses dépendances :

```typescript
// SANS DI — couplage fort
class BooksController {
  private booksService: BooksService;
  private logger: Logger;

  constructor() {
    // Le controller cree ses propres dependances
    this.booksService = new BooksService();
    this.logger = new Logger();
    // Et si BooksService a besoin d'une base de donnees ?
    // this.booksService = new BooksService(new Database(new Config()));
    // Ca devient vite ingerable...
  }
}
```

**Problemes** :
- **Couplage fort** : Le controller est lie à une implementation spécifique
- **Pas testable** : Impossible de remplacer BooksService par un mock
- **Pas flexible** : Si tu veux changer l'implementation, tu modifies le controller
- **Cascade** : Si BooksService change de constructeur, tous les consommateurs cassent

### 1.2 La solution : Injection de Dependances

Avec la DI, les dépendances sont **fournies de l'exterieur** par un conteneur :

```typescript
// AVEC DI — couplage faible
@Controller('books')
class BooksController {
  // Le constructeur DECLARE ses dependances
  // NestJS les FOURNIT automatiquement
  constructor(
    private readonly booksService: BooksService,
    private readonly logger: Logger,
  ) {}
  // Le controller ne sait PAS comment BooksService est cree
  // Il sait juste qu'il en a besoin
}
```

> **Analogie** : Sans DI, c'est comme si chaque employe d'une entreprise devait fabriquer lui-même ses outils. Avec DI, il y à un service d'approvisionnement (le conteneur DI) qui fournit les outils nécessaires à chaque employe. L'employe dit "j'ai besoin d'une perceuse" et le service lui en donne une — sans qu'il sache d'où elle vient ni comment elle est fabriquee.

### 1.3 Les 3 acteurs de la DI

| Acteur | Role | En NestJS |
|---|---|---|
| **Consumer** (consommateur) | La classe qui a besoin d'une dépendance | Controller, Service |
| **Provider** (fournisseur) | La classe ou valeur qui est injectee | `@Injectable()` service |
| **Container** (conteneur) | Le système qui géré les dépendances | Le conteneur IoC de NestJS |

```
  Container DI (NestJS IoC)
  ┌──────────────────────────────────────────────┐
  │                                              │
  │  Registre des providers :                    │
  │  ┌──────────────────────────────────┐        │
  │  │ BooksService  → instance unique  │        │
  │  │ UsersService  → instance unique  │        │
  │  │ Logger        → instance unique  │        │
  │  │ ConfigService → instance unique  │        │
  │  └──────────────────────────────────┘        │
  │                                              │
  │  Quand BooksController a besoin de           │
  │  BooksService, le container lui fournit      │
  │  l'instance existante (singleton)            │
  │                                              │
  └──────────────────────────────────────────────┘
```

---

## 2. Le decorateur @Injectable

### 2.1 Definition

`@Injectable()` marque une classe comme pouvant etre **gérée par le conteneur DI** de NestJS. Sans ce decorateur, NestJS ne peut pas injecter ni fournir la classe.

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class BooksService {
  private books = [];

  findAll() {
    return this.books;
  }

  create(data) {
    this.books.push(data);
    return data;
  }
}
```

### 2.2 Un service peut injecter d'autres services

```typescript
@Injectable()
export class BooksService {
  // BooksService depend de DatabaseService et LoggerService
  constructor(
    private readonly db: DatabaseService,
    private readonly logger: LoggerService,
  ) {}

  async findAll() {
    this.logger.log('Recuperation de tous les livres');
    return this.db.query('SELECT * FROM books');
  }
}
```

> **A retenir** : Toute classe qui a besoin d'etre injectee OU qui a des dépendances a injecter doit avoir `@Injectable()`. C'est le decorateur qui dit a NestJS "géré cette classe pour moi".

---

## 3. Injection par constructeur

### 3.1 Le mécanisme standard

```typescript
@Controller('books')
export class BooksController {
  // NestJS voit le type BooksService dans le constructeur
  // Il cherche un provider de ce type dans le module
  // Il l'injecte automatiquement
  constructor(private readonly booksService: BooksService) {}

  @Get()
  findAll() {
    return this.booksService.findAll();
  }
}
```

**Comment ça fonctionne en interne** :

1. NestJS lit les metadonnees TypeScript du constructeur (grâce à `emitDecoratorMetadata` dans tsconfig)
2. Il voit que `BooksController` a besoin de `BooksService`
3. Il cherche un provider de type `BooksService` dans le module
4. Il créé l'instance (où reutilise l'existante) et l'injecte

### 3.2 Le mot-clé private readonly

```typescript
// Raccourci TypeScript : declare ET initialise en une seule ligne
constructor(private readonly booksService: BooksService) {}

// Equivalent long
private readonly booksService: BooksService;
constructor(booksService: BooksService) {
  this.booksService = booksService;
}
```

> **Bonne pratique** : Utilise TOUJOURS `private readonly` pour les dépendances injectees. `private` empeche l'acces depuis l'exterieur, et `readonly` empeche la reassignation accidentelle.

---

## 4. Custom Providers

Par defaut, quand tu mets une classe dans le tableau `providers`, NestJS utilise la classe elle-même comme token ET comme implementation. Mais tu peux personnaliser cela.

### 4.1 Le provider standard (syntaxe courte)

```typescript
@Module({
  providers: [BooksService],
  // Equivalent de :
  // providers: [{ provide: BooksService, useClass: BooksService }],
})
```

### 4.2 useClass — Remplacer l'implementation

```typescript
// Interface (ou classe abstraite)
export abstract class PaymentService {
  abstract processPayment(amount: number): Promise<boolean>;
}

// Implementation Stripe
@Injectable()
export class StripePaymentService extends PaymentService {
  async processPayment(amount: number) {
    console.log(`Paiement Stripe de ${amount}EUR`);
    return true;
  }
}

// Implementation PayPal
@Injectable()
export class PaypalPaymentService extends PaymentService {
  async processPayment(amount: number) {
    console.log(`Paiement PayPal de ${amount}EUR`);
    return true;
  }
}

// Dans le module
@Module({
  providers: [
    {
      provide: PaymentService,       // Le token (ce que les consommateurs demandent)
      useClass: StripePaymentService, // L'implementation fournie
    },
  ],
})
export class PaymentModule {}

// Dans le controller
@Controller('orders')
export class OrdersController {
  // Injecte StripePaymentService, mais le controller ne le sait pas
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async createOrder() {
    await this.paymentService.processPayment(99.99);
  }
}
```

> **Analogie** : `useClass` c'est comme dire au service d'approvisionnement : "Quand quelqu'un demandé une voiture, donne-lui une Tesla". Le demandeur sait conduire une voiture, il se fiche de la marque.

### 4.3 useValue — Injecter une valeur fixe

```typescript
// Injecter un objet de configuration
const databaseConfig = {
  host: 'localhost',
  port: 5432,
  database: 'mydb',
};

@Module({
  providers: [
    {
      provide: 'DATABASE_CONFIG', // Token string
      useValue: databaseConfig,
    },
  ],
})
export class AppModule {}

// Pour l'injecter, il faut utiliser @Inject() avec le token string
@Injectable()
export class DatabaseService {
  constructor(@Inject('DATABASE_CONFIG') private config: any) {
    console.log(this.config.host); // 'localhost'
  }
}
```

```typescript
// Utile pour les mocks en tests
@Module({
  providers: [
    {
      provide: BooksService,
      useValue: {
        findAll: () => [{ id: '1', title: 'Mock Book' }],
        findOne: (id: string) => ({ id, title: 'Mock Book' }),
      },
    },
  ],
})
export class TestModule {}
```

### 4.4 useFactory — Création dynamique

```typescript
// useFactory permet de creer un provider avec une logique complexe
// et d'injecter d'autres providers dans la factory

@Module({
  providers: [
    ConfigService,
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: async (configService: ConfigService) => {
        const config = configService.get('database');
        const connection = await createConnection({
          host: config.host,
          port: config.port,
          database: config.database,
        });
        return connection;
      },
      inject: [ConfigService], // Dependances de la factory
    },
  ],
})
export class DatabaseModule {}

// La factory est appelee avec les services listes dans inject
// Elle peut etre async (retourner une Promise)
```

```typescript
// Factory conditionnelle
@Module({
  providers: [
    {
      provide: PaymentService,
      useFactory: (config: ConfigService) => {
        const provider = config.get('PAYMENT_PROVIDER');
        if (provider === 'stripe') {
          return new StripePaymentService(config.get('STRIPE_KEY'));
        }
        return new PaypalPaymentService(config.get('PAYPAL_KEY'));
      },
      inject: [ConfigService],
    },
  ],
})
export class PaymentModule {}
```

> **A retenir** : `useFactory` est la façon la plus flexible de créer des providers. Tu l'utilises quand la création nécessité de la logique, des operations async (connexion DB), ou des decisions conditionnelles.

### 4.5 useExisting — Alias de provider

```typescript
// useExisting cree un alias pour un provider existant
@Module({
  providers: [
    LoggerService,
    {
      provide: 'AliasedLogger',       // Token alias
      useExisting: LoggerService,      // Pointe vers le meme provider
    },
  ],
})
export class AppModule {}

// Les deux tokens referent a la MEME instance
```

### 4.6 Tableau récapitulatif

| Type | Utilisation | Quand l'utiliser |
|---|---|---|
| **useClass** | `{ provide: Token, useClass: Impl }` | Remplacer une implementation (patterns Strategy, tests) |
| **useValue** | `{ provide: Token, useValue: value }` | Constantes, configurations, mocks |
| **useFactory** | `{ provide: Token, useFactory: fn, inject: [...] }` | Création dynamique, async, conditionnelle |
| **useExisting** | `{ provide: Token, useExisting: ExistingToken }` | Alias, retro-compatibilite |

---

## 5. Tokens d'injection

### 5.1 Token par classe (defaut)

```typescript
// Le type de la classe sert de token
constructor(private readonly service: BooksService) {}
// NestJS utilise BooksService comme token pour trouver le provider
```

### 5.2 Token par string

```typescript
// Quand le provider n'est pas une classe
@Module({
  providers: [
    { provide: 'API_KEY', useValue: 'ma-cle-secrete' },
  ],
})
export class AppModule {}

// Injection avec @Inject
constructor(@Inject('API_KEY') private apiKey: string) {}
```

### 5.3 Token par Symbol (recommande pour les strings)

```typescript
// constants.ts
export const DATABASE_CONFIG = Symbol('DATABASE_CONFIG');
export const LOGGER_TOKEN = Symbol('LOGGER_TOKEN');

// Module
@Module({
  providers: [
    { provide: DATABASE_CONFIG, useValue: { host: 'localhost' } },
  ],
})
export class AppModule {}

// Injection
constructor(@Inject(DATABASE_CONFIG) private config: any) {}
```

> **Bonne pratique** : Utilise des `Symbol` plutot que des strings pour les tokens personnalises. Les Symbols sont uniques — deux modules ne peuvent pas avoir de collision de noms. Les strings `'DATABASE_CONFIG'` pourraient entrer en conflit.

---

## 6. Les decorateurs @Optional et @Inject

### 6.1 @Optional — Dependance facultative

```typescript
import { Optional, Inject } from '@nestjs/common';

@Injectable()
export class NotificationService {
  constructor(
    @Optional() @Inject('SMS_SERVICE') private smsService?: SmsService,
    @Optional() @Inject('EMAIL_SERVICE') private emailService?: EmailService,
  ) {}

  async notify(message: string) {
    if (this.emailService) {
      await this.emailService.send(message);
    }
    if (this.smsService) {
      await this.smsService.send(message);
    }
    // Si aucun service n'est configure, on ne fait rien
    // Au lieu de lancer une erreur au demarrage
  }
}
```

### 6.2 @Inject — Injection explicite

```typescript
// @Inject est necessaire quand le token n'est pas un type de classe
constructor(
  @Inject('API_KEY') private apiKey: string,
  @Inject(DATABASE_CONFIG) private dbConfig: object,
  @Inject(LoggerService) private logger: LoggerService, // Explicite (inutile ici)
) {}
```

---

## 7. Scopes des providers

### 7.1 Les trois scopes

Par defaut, tous les providers sont des **singletons** (une seule instance pour toute l'application). NestJS propose trois scopes :

| Scope | Comportement | Cas d'usage |
|---|---|---|
| **DEFAULT** (singleton) | Une instance pour toute l'application | 95% des cas |
| **REQUEST** | Une nouvelle instance par requête HTTP | Logger avec request ID, tenant multi-client |
| **TRANSIENT** | Une nouvelle instance à chaque injection | Objets avec état mutable |

### 7.2 Scope DEFAULT (singleton)

```typescript
// C'est le comportement par defaut — pas besoin de le specifier
@Injectable()
export class BooksService {
  private books = []; // ATTENTION : cet etat est partage entre toutes les requetes !

  // Si la requete A ajoute un livre,
  // la requete B le verra aussi
}
```

> **Piege classique** : Avec le scope singleton, l'état du service est partage entre TOUTES les requêtes. Ne stocke pas de donnees spécifiques à une requête dans un service singleton. Pour des donnees par requête (comme l'utilisateur courant), utilise le scope REQUEST.

### 7.3 Scope REQUEST

```typescript
import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class RequestLoggerService {
  private requestId: string;

  setRequestId(id: string) {
    this.requestId = id;
  }

  log(message: string) {
    console.log(`[${this.requestId}] ${message}`);
  }
}
```

### 7.4 Scope TRANSIENT

```typescript
@Injectable({ scope: Scope.TRANSIENT })
export class CounterService {
  private count = 0;

  increment() {
    this.count++;
    return this.count;
  }
}

// Chaque consommateur qui injecte CounterService
// recoit sa propre instance avec son propre compteur
```

> **Bonne pratique** : Utilise le scope DEFAULT (singleton) pour presque tout. Les scopes REQUEST et TRANSIENT ont un impact sur les performances car NestJS doit créer de nouvelles instances. N'utilise REQUEST que quand tu as vraiment besoin de donnees par requête (multi-tenant, request logging).

---

## 8. Cycle de vie des providers

```
  Application NestJS demarre
       │
       ▼
  ┌──────────────────────────┐
  │  Resolution des modules   │  NestJS analyse les @Module
  └────────────┬─────────────┘
               │
  ┌────────────▼─────────────┐
  │  Creation des providers   │  NestJS cree les singletons
  │  (ordre de dependance)    │  dans le bon ordre
  └────────────┬─────────────┘
               │
  ┌────────────▼─────────────┐
  │  onModuleInit()           │  Hook optionnel
  └────────────┬─────────────┘
               │
  ┌────────────▼─────────────┐
  │  onApplicationBootstrap() │  Hook optionnel
  └────────────┬─────────────┘
               │
  ┌────────────▼─────────────┐
  │  Application prete        │  app.listen()
  └────────────┬─────────────┘
               │
  ... (application tourne) ...
               │
  ┌────────────▼─────────────┐
  │  onModuleDestroy()        │  Hook optionnel (avant la fermeture)
  └────────────┬─────────────┘
               │
  ┌────────────▼─────────────┐
  │  beforeApplicationShutdown() │  Hook optionnel
  └────────────┬─────────────┘
               │
  ┌────────────▼─────────────┐
  │  onApplicationShutdown()  │  Hook optionnel
  └──────────────────────────┘
```

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private connection;

  async onModuleInit() {
    // Appele quand le module est initialise
    this.connection = await createDatabaseConnection();
    console.log('Connexion base de donnees etablie');
  }

  async onModuleDestroy() {
    // Appele quand l'application s'arrete
    await this.connection.close();
    console.log('Connexion base de donnees fermee');
  }
}
```

---

## 9. Pourquoi la DI est importante

### 9.1 Testabilite

```typescript
// SANS DI — difficile a tester
class BooksController {
  private service = new BooksService(new Database());

  // Comment tester sans la vraie base de donnees ?
  // Impossible de mocker BooksService !
}

// AVEC DI — facile a tester
@Controller('books')
class BooksController {
  constructor(private readonly service: BooksService) {}
}

// Dans le test, on injecte un mock
const mockService = {
  findAll: jest.fn().mockReturnValue([{ id: '1', title: 'Mock' }]),
};

const controller = new BooksController(mockService as any);
expect(controller.findAll()).toEqual([{ id: '1', title: 'Mock' }]);
```

### 9.2 Decouplage

```typescript
// Le controller depend d'une ABSTRACTION, pas d'une implementation
@Controller('orders')
class OrdersController {
  constructor(private readonly payment: PaymentService) {}
}

// Tu peux changer l'implementation sans toucher au controller
// Dev : MockPaymentService
// Test : FakePaymentService
// Prod : StripePaymentService
```

### 9.3 Flexibilite et configuration

```typescript
// Meme code, comportement different selon l'environnement
@Module({
  providers: [
    {
      provide: CacheService,
      useFactory: (config: ConfigService) => {
        if (config.get('NODE_ENV') === 'production') {
          return new RedisCacheService(config.get('REDIS_URL'));
        }
        return new InMemoryCacheService();
      },
      inject: [ConfigService],
    },
  ],
})
export class CacheModule {}
```

---

## 10. Exemples concrets

### 10.1 Service de notification multi-canal

```typescript
// Interfaces
export interface NotificationChannel {
  send(to: string, message: string): Promise<void>;
}

// Implementations
@Injectable()
export class EmailChannel implements NotificationChannel {
  async send(to: string, message: string) {
    console.log(`Email envoye a ${to}: ${message}`);
  }
}

@Injectable()
export class SmsChannel implements NotificationChannel {
  async send(to: string, message: string) {
    console.log(`SMS envoye a ${to}: ${message}`);
  }
}

@Injectable()
export class SlackChannel implements NotificationChannel {
  async send(to: string, message: string) {
    console.log(`Message Slack a ${to}: ${message}`);
  }
}

// Service qui utilise tous les canaux
@Injectable()
export class NotificationService {
  constructor(
    @Inject('NOTIFICATION_CHANNELS')
    private readonly channels: NotificationChannel[],
  ) {}

  async notifyAll(to: string, message: string) {
    await Promise.all(
      this.channels.map(channel => channel.send(to, message))
    );
  }
}

// Module avec configuration
@Module({
  providers: [
    EmailChannel,
    SmsChannel,
    SlackChannel,
    {
      provide: 'NOTIFICATION_CHANNELS',
      useFactory: (email: EmailChannel, sms: SmsChannel, slack: SlackChannel) => {
        return [email, sms, slack];
      },
      inject: [EmailChannel, SmsChannel, SlackChannel],
    },
    NotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
```

### 10.2 Service avec configuration dynamique

```typescript
// Logger configurable
@Injectable()
export class LoggerService {
  constructor(
    @Inject('LOG_LEVEL') private readonly logLevel: string,
    @Inject('LOG_PREFIX') private readonly prefix: string,
  ) {}

  log(message: string) {
    if (['debug', 'info', 'warn', 'error'].indexOf(this.logLevel) <= 1) {
      console.log(`[${this.prefix}] INFO: ${message}`);
    }
  }

  error(message: string) {
    console.error(`[${this.prefix}] ERROR: ${message}`);
  }
}

@Module({
  providers: [
    { provide: 'LOG_LEVEL', useValue: process.env.LOG_LEVEL || 'info' },
    { provide: 'LOG_PREFIX', useValue: 'MonAPI' },
    LoggerService,
  ],
  exports: [LoggerService],
})
export class LoggerModule {}
```

---

## 11. Exercices pratiques

### Exercice 1 — Provider conditionnel

Cree un `StorageService` avec deux implementations : `LocalStorageService` (fichiers) et `S3StorageService` (AWS S3). Utilise `useFactory` pour choisir l'implementation selon une variable d'environnement.

### Exercice 2 — Service avec hooks de cycle de vie

Cree un `CacheService` qui initialise un cache en mémoire dans `onModuleInit` et le nettoie dans `onModuleDestroy`.

### Exercice 3 — Tester avec des mocks DI

Ecris un test unitaire pour un `BooksController` en mockant le `BooksService` via l'injection de dépendances de NestJS (`Test.createTestingModule`).

---

## 12. Résumé — Les concepts clés

| Concept | Definition |
|---|---|
| **DI** | Les dépendances sont fournies par un conteneur, pas creees manuellement |
| **@Injectable** | Marque une classe comme gérée par le conteneur DI |
| **Provider** | Tout ce qui peut etre injecte (classe, valeur, factory) |
| **useClass** | Remplacer l'implementation d'un token |
| **useValue** | Injecter une valeur constante |
| **useFactory** | Créer un provider dynamiquement |
| **useExisting** | Créer un alias pour un provider |
| **Token** | Identifiant unique d'un provider (classe, string, Symbol) |
| **@Inject** | Injection explicite avec un token personnalise |
| **@Optional** | Dependance facultative (pas d'erreur si absente) |
| **Scope** | DEFAULT (singleton), REQUEST, TRANSIENT |

> **A retenir** : L'injection de dépendances est le mécanisme central de NestJS. Elle rend ton code testable (mocks faciles), decouple (changement d'implementation transparent) et flexible (configuration par environnement). Maîtrise les custom providers (useClass, useValue, useFactory) — ils sont la clé pour des architectures propres et modulaires.

---

## Navigation

| | Lien |
|---|---|
| Module précédent | [Module 10 — NestJS — Controllers & Routing](./10-nestjs-controllers.md) |
| Module suivant | [Module 12 — NestJS — Modules & Architecture](./12-nestjs-modules.md) |
| Quiz | [Quiz Module 11](../quizzes/11-nestjs-providers-di.quiz.md) |
| Lab | [Lab 11 — Providers et DI](../labs/11-nestjs-providers-di.lab.md) |

---

> **A retenir** : L'injection de dépendances n'est pas qu'un outil technique — c'est une philosophie de conception. En declarant tes dépendances dans le constructeur plutot qu'en les creant toi-même, tu respectes le principe d'Inversion de Dependance (le D de SOLID) : tes modules de haut niveau ne dependent pas de modules de bas niveau, les deux dependent d'abstractions. C'est la base d'une architecture propre et evolutive.

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 11 providers di](../screencasts/screencast-11-providers-di.md)
2. **Lab** : [lab-11-providers-di](../labs/lab-11-providers-di/README)
3. **Visualisation** : [Dependency Injection](../visualizations/dependency-injection.html)
4. **Quiz** : [quiz 11 providers di](../quizzes/quiz-11-providers-di.html)
:::
