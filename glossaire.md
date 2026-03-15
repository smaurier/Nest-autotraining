# Glossaire

Termes clés utilises tout au long de la formation, classes par ordre alphabetique.

---

## A

### async/await {#async-await}
Syntaxe JavaScript introduite en ES2017 pour écrire du code asynchrone de manière sequentielle et lisible. `async` marque une fonction comme retournant une Promise, et `await` suspend l'exécution jusqu'à la résolution de la Promise. Remplace les callbacks imbriques et les chaines `.then()` pour un code plus clair et maintenable.

### Authentication {#authentication}
Processus de vérification de l'identite d'un utilisateur ou d'un système. Dans une API REST, l'authentification se fait généralement via un token JWT envoye dans le header `Authorization`. NestJS propose un système modulaire d'authentification base sur Passport et les stratégies (Local, JWT, OAuth).

### Authorization {#authorization}
Processus de vérification des permissions d'un utilisateur authentifie pour acceder à une ressource ou effectuer une action. Dans NestJS, l'autorisation est implementee via des Guards qui verifient les roles (RBAC) ou les permissions avant d'autoriser l'acces à un endpoint.

## B

### Backpressure {#backpressure}
Mécanisme de controle de flux dans les streams Node.js qui empeche un producteur rapide de submerger un consommateur lent. Quand le buffer interne d'un WritableStream est plein, `write()` retourne `false` et le producteur doit attendre l'événement `drain` avant de continuer. Essentiel pour traiter de gros fichiers sans saturer la mémoire.

### bcrypt {#bcrypt}
Algorithme de hachage de mots de passe concu pour etre volontairement lent, resistant aux attaques par force brute et par rainbow tables. Integre un salt automatique et un facteur de cout configurable. Utilise dans Express et NestJS via le package `bcryptjs` ou `bcrypt` pour stocker les mots de passe de manière securisee.

### Body Parser {#body-parser}
Middleware Express qui parse le corps des requêtes HTTP entrantes et rend les donnees accessibles via `req.body`. Supporte les formats JSON (`express.json()`), URL-encoded (`express.urlencoded()`), et raw/text. Integre nativement dans Express depuis la version 4.16.

### Buffer {#buffer}
Objet Node.js representant une zone de mémoire brute de taille fixe, utilisee pour manipuler des donnees binaires (fichiers, images, flux réseau). Contrairement aux strings JavaScript (UTF-16), les Buffers stockent des octets bruts. Se créé avec `Buffer.from()`, `Buffer.alloc()` ou `Buffer.allocUnsafe()`.

### BullMQ {#bullmq}
Bibliotheque Node.js de gestion de files d'attente (job queues) basee sur Redis. Permet de créer des workers, des taches planifiees, des taches repetables, et des workflows complexes. Integree dans NestJS via `@nestjs/bullmq` pour le traitement asynchrone de taches en arriere-plan.

## C

### Callback {#callback}
Fonction passee en argument à une autre fonction, appelee lorsque l'operation asynchrone est terminee. Pattern fondamental de Node.js avec la convention `(error, result)` dite "error-first callback". Remplace progressivement par les Promises et async/await, mais toujours present dans les API natives Node.js.

### class-transformer {#class-transformer}
Bibliotheque TypeScript qui transforme des objets JavaScript simples en instances de classes et inversement. Utilisee dans NestJS avec les decorateurs `@Exclude()`, `@Expose()`, `@Transform()` pour controler la serialisation des réponses API et exclure les champs sensibles comme les mots de passe.

### class-validator {#class-validator}
Bibliotheque TypeScript de validation basee sur des decorateurs (`@IsString()`, `@IsEmail()`, `@MinLength()`, `@IsOptional()`) appliques sur les propriétés de classes DTO. Integree dans NestJS via le `ValidationPipe` pour valider automatiquement les donnees entrantes des requêtes HTTP.

### CLI NestJS {#cli-nestjs}
Outil en ligne de commande (`@nestjs/cli`) qui généré et géré les projets NestJS. Commandes principales : `nest new` (nouveau projet), `nest generate` (modules, controllers, services), `nest build` (compilation), `nest start` (démarrage). Respecte les conventions d'architecture NestJS.

### CommonJS {#commonjs}
Système de modules historique de Node.js utilisant `require()` pour importer et `module.exports` pour exporter. Chargement synchrone des modules. Progressivement remplace par ESM (ECMAScript Modules) mais reste très present dans l'ecosysteme npm et utilise par defaut dans Node.js sans configuration spécifique.

### ConfigModule {#configmodule}
Module NestJS (`@nestjs/config`) qui centralise la gestion des variables d'environnement et de la configuration applicative. Charge les fichiers `.env` via `dotenv`, supporte la validation de schema (Joi/Zod), les namespaces de configuration, et le chargement asynchrone. Rendu global avec `isGlobal: true`.

### ConfigService {#configservice}
Service injectable fourni par `@nestjs/config` pour acceder aux variables de configuration de manière typee et securisee. Méthode principale : `configService.get<string>('DATABASE_URL')`. Preferable a `process.env` car centralise, testable et supporte les valeurs par defaut.

### Controller {#controller}
Classe NestJS decoree avec `@Controller()` qui géré les requêtes HTTP entrantes et retourne des réponses. Chaque méthode du controller est associee à une route HTTP via des decorateurs comme `@Get()`, `@Post()`, `@Put()`, `@Delete()`. Le controller délégué la logique metier aux Services/Providers.

### CORS {#cors}
Cross-Origin Resource Sharing : mécanisme HTTP qui permet à un serveur d'autoriser les requêtes provenant d'un domaine différent de celui de l'API. Configure dans Express via le middleware `cors` et dans NestJS via `app.enableCors()`. Essentiel pour les applications frontend/backend separees.

### CRUD {#crud}
Acronyme pour Create, Read, Update, Delete — les quatre operations de base sur une ressource. Dans une API REST, elles correspondent aux méthodes HTTP POST, GET, PUT/PATCH, DELETE. NestJS fournit des generateurs (`nest g resource`) qui creent automatiquement le squelette CRUD complet.

### Cursor Pagination {#cursor-pagination}
Technique de pagination basee sur un curseur (généralement l'ID ou un timestamp du dernier élément) plutot que sur un offset. Plus performante que l'offset pagination pour les grands volumes de donnees car evite le `SKIP` couteux en base. Implementee avec `WHERE id > :cursor LIMIT :limit`.

### Custom Decorator {#custom-decorator}
Decorateur TypeScript personalise créé avec `createParamDecorator()` dans NestJS pour extraire des donnees spécifiques de la requête. Exemple : `@CurrentUser()` pour récupérer l'utilisateur authentifie, `@Roles('admin')` pour marquer les endpoints necessitant un role spécifique. Favorise la reutilisabilite et la lisibilite du code.

## D

### DataSource {#datasource}
Objet central de TypeORM qui encapsule la connexion à la base de donnees, la configuration des entites, les migrations et le gestionnaire d'entites. Initialise avec `new DataSource({...})` et configure dans NestJS via `TypeOrmModule.forRoot()`. Chaque DataSource represente une connexion à une base de donnees.

### Dead Letter Queue {#dead-letter-queue}
File d'attente speciale ou sont places les messages/jobs qui ont echoue après un nombre maximum de tentatives. Permet d'isoler les erreurs sans bloquer la file principale et d'analyser les echecs ulterieurement. Configure dans BullMQ avec l'option `attempts` et le handler `on('failed')`.

### Dependency Injection {#dependency-injection}
Pattern de conception ou les dépendances d'une classe sont fournies par un conteneur externe plutot que creees par la classe elle-même. Mécanisme central de NestJS : les providers sont declares dans les modules et injectes automatiquement dans les constructeurs des classes qui en ont besoin via le decorateur `@Injectable()`.

### Docker {#docker}
Plateforme de conteneurisation qui emballe une application et ses dépendances dans un conteneur leger et portable. Utilise dans ce cours pour PostgreSQL, Redis, et le déploiement de l'API NestJS. Un `Dockerfile` définit l'image, et `docker-compose.yml` orchestre les services multiples.

### DTO {#dto}
Data Transfer Object : objet qui définit la forme des donnees echangees entre le client et le serveur. Dans NestJS, les DTO sont des classes TypeScript decorees avec class-validator pour la validation automatique. Exemple : `CreateUserDto` définit les champs requis pour créer un utilisateur.

## E

### E2E Test {#e2e-test}
Test de bout en bout qui valide le comportement d'une API complete, de la requête HTTP à la réponse, en passant par tous les middleware, guards, pipes et services. Dans NestJS, les tests e2e utilisent `supertest` pour envoyer de vraies requêtes HTTP a l'application et vérifier les réponses.

### Entity {#entity}
Classe TypeORM decoree avec `@Entity()` qui represente une table de la base de donnees. Chaque propriété decoree avec `@Column()`, `@PrimaryGeneratedColumn()`, ou des decorateurs de relation (`@OneToMany()`, `@ManyToOne()`) correspond à une colonne ou une relation. L'entite est le pont entre le code TypeScript et la table SQL.

### ESM {#esm}
ECMAScript Modules : système de modules standard de JavaScript utilisant `import`/`export`. Supporte le chargement asynchrone, le tree-shaking, et les imports statiques. Active dans Node.js avec `"type": "module"` dans `package.json` ou l'extension `.mjs`. Progressivement adopte comme standard en remplacement de CommonJS.

### Event Loop {#event-loop}
Boucle d'événements au coeur de Node.js qui géré l'exécution du code asynchrone. Compose de plusieurs phases (timers, pending callbacks, poll, check, close) qui s'executent en boucle. Permet a Node.js d'etre mono-thread tout en gerant des milliers de connexions concurrentes sans bloquer. Implemente par libuv.

### EventEmitter {#eventemitter}
Classe fondamentale de Node.js (`events` module) qui implemente le pattern Observer. Permet d'emettre des événements nommes et d'y attacher des listeners. Les streams, le serveur HTTP et de nombreux objets Node.js heritent d'EventEmitter. Méthodes principales : `on()`, `emit()`, `once()`, `removeListener()`.

### Exception Filter {#exception-filter}
Mécanisme NestJS qui intercepte les exceptions non gerees et les transforme en réponses HTTP structurees. Le filtre par defaut géré les `HttpException`. Les filtres personnalises (avec `@Catch()`) permettent de capturer des types d'erreurs spécifiques et de formater les réponses d'erreur de manière coherente.

### Express {#express}
Framework web minimaliste et flexible pour Node.js. Fournit le routing, les middleware, la gestion des requêtes/réponses, et un ecosysteme riche de plugins. Sert de couche HTTP sous-jacente a NestJS (alternative : Fastify). Le framework web le plus utilise de l'ecosysteme Node.js.

## F

### Factory Provider {#factory-provider}
Type de provider NestJS ou la valeur est créée par une fonction factory (`useFactory`) qui peut recevoir des dépendances injectees. Utile pour la configuration conditionnelle, les connexions asynchrones, ou la création de providers dynamiques. Exemple : créer un client Redis avec une configuration chargee depuis `ConfigService`.

### Feature Module {#feature-module}
Module NestJS qui encapsule une fonctionnalite spécifique de l'application (ex : `UsersModule`, `AuthModule`, `ProductsModule`). Regroupe les controllers, services et entites lies a cette fonctionnalite. Favorise la separation des responsabilites et la reutilisabilite du code.

### forRoot/forRootAsync {#forroot-forrootasync}
Convention NestJS pour les modules dynamiques qui necessitent une configuration. `forRoot()` accepte une configuration statique, `forRootAsync()` accepte une configuration asynchrone (via `useFactory`, `useClass`, ou `useExisting`). Utilise par `TypeOrmModule`, `ConfigModule`, `BullModule` et d'autres modules tiers.

## G

### Global Module {#global-module}
Module NestJS decore avec `@Global()` dont les providers sont accessibles dans toute l'application sans avoir besoin de l'importer dans chaque module. Utile pour les services transversaux comme la configuration, le logging ou la connexion à la base de donnees. A utiliser avec parcimonie pour éviter le couplage.

### Guard {#guard}
Classe NestJS implementant `CanActivate` qui déterminé si une requête doit etre autorisee ou refusee avant d'atteindre le handler. Execute après les middleware et avant les interceptors/pipes. Cas d'usage principaux : authentification (`AuthGuard`), autorisation par role (`RolesGuard`), rate limiting.

## H

### Helmet {#helmet}
Middleware Express/NestJS qui sécurisé l'application en definissant divers en-tetes HTTP de sécurité : `X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`, `Content-Security-Policy`, etc. S'installe avec `app.use(helmet())` dans Express ou `app.use(helmet())` dans NestJS. Indispensable en production.

### HTTP Module Node {#http-module-node}
Module natif de Node.js (`node:http`) qui fournit les classes `Server`, `IncomingMessage` et `ServerResponse` pour créer des serveurs HTTP sans framework externe. Base de tous les frameworks web Node.js (Express, Koa, Fastify). Permet de comprendre le fonctionnement bas niveau du protocole HTTP.

## I

### Interceptor {#interceptor}
Classe NestJS implementant `NestInterceptor` qui enveloppe l'exécution du handler. Execute avant et après le handler, permet de transformer la réponse, ajouter du logging, du caching, mesurer les temps d'exécution, ou appliquer des transformations globales. Utilise le pattern RxJS Observable.

### Injectable {#injectable}
Decorateur NestJS (`@Injectable()`) qui marque une classe comme un provider pouvant etre géré par le conteneur d'injection de dépendances. Toute classe qui doit etre injectee dans d'autres classes (services, repositories, helpers) doit porter ce decorateur. C'est le decorateur fondamental du système DI de NestJS.

### Intégration Test {#intégration-test}
Test qui vérifié le fonctionnement correct de plusieurs composants ensemble (service + repository + base de donnees). Dans NestJS, les tests d'intégration utilisent `Test.createTestingModule()` pour créer un module de test avec de vraies implementations (où des mocks partiels) et vérifier les interactions entre composants.

## J

### Jest {#jest}
Framework de test JavaScript développé par Meta, utilise par defaut dans les projets NestJS. Fournit un test runner, des assertions (`expect`), des mocks/spies (`jest.fn()`, `jest.spyOn()`), le code coverage, et les snapshots. Configure dans NestJS pour les tests unitaires (`.spec.ts`) et e2e (`.e2e-spec.ts`).

### JSON Web Token {#json-web-token}
Standard ouvert (RFC 7519) pour transmettre des informations de manière securisee sous forme d'un token signe. Compose de trois parties : Header, Payload et Signature, encodes en Base64. Utilise pour l'authentification stateless dans les API REST. Le serveur signe le token avec un secret et le client le renvoie dans le header `Authorization: Bearer <token>`.

### JWT Strategy {#jwt-strategy}
Stratégie Passport (`passport-jwt`) qui extrait et valide un JWT du header `Authorization`. Dans NestJS, implementee comme un provider avec `@Injectable()` et `extends PassportStrategy(Strategy)`. Configure l'extraction du token, le secret de vérification, et retourne l'utilisateur decode dans la requête.

## L

### libuv {#libuv}
Bibliotheque C multiplateforme qui fournit l'event loop, le pool de threads, les operations d'I/O asynchrones et les primitives de concurrence a Node.js. Gere les operations système (fichiers, réseau, DNS, timers) et délégué les operations bloquantes à un pool de threads (par defaut 4 threads).

### Local Strategy {#local-strategy}
Stratégie Passport (`passport-local`) qui authentifie un utilisateur à partir d'un nom d'utilisateur et d'un mot de passe envoyes dans le corps de la requête. Dans NestJS, utilisee pour le endpoint de login (`POST /auth/login`). Valide les credentials et retourne un JWT si l'authentification reussit.

## M

### Middleware {#middleware}
Fonction qui s'exécuté entre la reception de la requête et l'envoi de la réponse. Dans Express : `(req, res, next) => { ... }`. Dans NestJS : classe implementant `NestMiddleware` ou fonction middleware. Les middleware s'executent dans l'ordre de declaration et peuvent modifier la requête, la réponse, ou interrompre le cycle.

### Migration {#migration}
Fichier qui decrit une modification du schema de la base de donnees (création de table, ajout de colonne, index). Les migrations sont versionnees et executees dans l'ordre pour maintenir le schema a jour. TypeORM généré les migrations avec `typeorm migration:generate`. Prisma utilise `prisma migrate dev`.

### Module {#module}
Unite d'organisation dans NestJS, decoree avec `@Module()`. Chaque module declare ses `imports` (autres modules), `controllers`, `providers` et `exports`. L'application NestJS est un arbre de modules, avec le `AppModule` comme racine. Chaque module encapsule un domaine fonctionnel.

### Morgan {#morgan}
Middleware de logging HTTP pour Express qui affiche les details de chaque requête (méthode, URL, status, temps de réponse). Formats predifinis : `dev` (colore, concis), `combined` (format Apache), `tiny` (minimal). Utile en développement pour debugger les requêtes et en production pour l'observabilité.

### Multer {#multer}
Middleware Express pour le traitement des requêtes `multipart/form-data`, utilise principalement pour l'upload de fichiers. Configure le stockage (disque ou mémoire), les limites de taille, et le filtrage des fichiers. Integre dans NestJS via `@UseInterceptors(FileInterceptor())` et le decorateur `@UploadedFile()`.

## N

### NestJS {#nestjs}
Framework Node.js progressif pour construire des applications backend efficaces et scalables. Inspire par Angular, il utilise TypeScript, la programmation orientee objet, la programmation fonctionnelle et la programmation réactive. Architecture modulaire basee sur l'injection de dépendances avec un support natif pour REST, GraphQL, WebSockets et microservices.

### nest-cli {#nest-cli}
Fichier de configuration `nest-cli.json` à la racine d'un projet NestJS qui définit les options du compilateur, le chemin source, le dossier de sortie et les options de génération. Utilise par la CLI NestJS pour la compilation (`nest build`), le démarrage (`nest start --watch`) et la génération de code.

### node_modules {#node-modules}
Dossier ou npm installe les dépendances du projet. Chaque package est place dans un sous-dossier avec ses propres dépendances (structure plate depuis npm v3+). Ce dossier ne doit jamais etre versionne (ajoute au `.gitignore`) et peut etre regenere avec `npm install` à partir du `package.json`.

### nodemon {#nodemon}
Utilitaire qui surveille les fichiers source et redemarre automatiquement le processus Node.js à chaque modification. Remplace `node` par `nodemon` pour le développement. Alternative : le flag `--watch` natif de Node.js 18+. Dans NestJS, le mode watch est intégré via `nest start --watch`.

### npm {#npm}
Node Package Manager : gestionnaire de paquets par defaut de Node.js. Installe les dépendances (`npm install`), exécuté les scripts (`npm run`), publie des packages (`npm publish`). Le fichier `package.json` declare les dépendances et les scripts, `package-lock.json` verrouille les versions exactes.

## O

### OnModuleInit {#onmoduleinit}
Interface de cycle de vie NestJS que les providers peuvent implementer pour exécuter du code a l'initialisation du module. La méthode `onModuleInit()` est appelee une fois que toutes les dépendances sont resolues. Cas d'usage : connexion à une base de donnees, initialisation d'un cache, configuration d'un client externe.

## P

### Passport {#passport}
Middleware d'authentification pour Node.js qui supporte plus de 500 stratégies (Local, JWT, OAuth, SAML, etc.). Dans NestJS, intégré via `@nestjs/passport` qui fournit `AuthGuard()` et `PassportStrategy`. Chaque stratégie est un provider injectable qui définit la logique de validation des credentials.

### Pipe {#pipe}
Classe NestJS implementant `PipeTransform` qui transforme ou valide les donnees d'entree avant qu'elles n'atteignent le handler. Pipes integres : `ValidationPipe` (validation DTO), `ParseIntPipe` (conversion string→int), `ParseUUIDPipe`. Les pipes s'appliquent au niveau du paramètre, de la méthode, du controller ou globalement.

### PM2 {#pm2}
Gestionnaire de processus pour les applications Node.js en production. Fournit le clustering (multi-instances), le redemarrage automatique en cas de crash, le monitoring, les logs, et le déploiement zero-downtime. Configure via `ecosystem.config.js` pour définir les instances, les variables d'environnement et les stratégies de redemarrage.

### Prisma {#prisma}
ORM next-génération pour Node.js et TypeScript. Se distingue par son schema declaratif (`schema.prisma`), son client type-safe auto-généré, et ses migrations versionnees. Approche "schema-first" : le schema Prisma est la source de verite pour la base de donnees et le code TypeScript.

### PrismaClient {#prismaclient}
Client auto-généré par Prisma à partir du schema `schema.prisma`. Fournit une API type-safe pour les operations CRUD, les requêtes relationnelles, les filtres, le tri, la pagination et les transactions. Regenere avec `prisma generate` après chaque modification du schema.

### PrismaService {#prismaservice}
Service NestJS personnalise qui etend `PrismaClient` et implemente `OnModuleInit` pour gérer la connexion à la base de donnees. Injecte dans les services de l'application pour acceder à la base de donnees via Prisma. Gere la connexion (`$connect()`) et la deconnexion (`$disconnect()`).

### process {#process}
Objet global Node.js qui fournit des informations et un controle sur le processus en cours. Proprietes utiles : `process.env` (variables d'environnement), `process.argv` (arguments CLI), `process.cwd()` (répertoire courant), `process.exit()` (arret). Emet aussi des événements comme `uncaughtException` et `unhandledRejection`.

### Promise {#promise}
Objet JavaScript representant le résultat eventuel (où l'echec) d'une operation asynchrone. Trois états : pending, fulfilled, rejected. Les méthodes `.then()`, `.catch()`, `.finally()` permettent de chainer les operations. Base d'async/await. Les API modernes de Node.js retournent des Promises via les modules `fs/promises`, `dns/promises`, etc.

### Provider {#provider}
Concept fondamental de NestJS. Tout ce qui peut etre injecte : services, repositories, factories, helpers. Declare dans le tableau `providers` d'un module et decore avec `@Injectable()`. Les providers sont geres par le conteneur DI de NestJS qui resout automatiquement les dépendances au démarrage.

## Q

### QueryBuilder {#querybuilder}
API fluide de TypeORM pour construire des requêtes SQL complexes de manière programmatique. Supporte les jointures, les conditions, le groupement, le tri, la pagination et les sous-requêtes. Obtenu via `repository.createQueryBuilder('alias')`. Plus flexible que les méthodes de repository simples pour les requêtes avancees.

### QueryRunner {#queryrunner}
Objet TypeORM qui encapsule une connexion à la base de donnees et permet d'exécuter des requêtes SQL brutes, de gérer des transactions manuelles (`startTransaction()`, `commitTransaction()`, `rollbackTransaction()`) et d'exécuter des migrations. Utile quand le Repository ou le QueryBuilder ne suffisent pas.

## R

### Rate Limiting {#rate-limiting}
Technique de sécurité qui limite le nombre de requêtes qu'un client peut envoyer dans une fenêtre de temps donnee. Protege contre les attaques par deni de service (DoS) et les abus. Dans NestJS, implemente via `@nestjs/throttler` avec le decorateur `@Throttle()` et le guard `ThrottlerGuard`.

### RBAC {#rbac}
Role-Based Access Control : modèle d'autorisation ou les permissions sont attribuees a des roles (admin, user, editor) plutot qu'a des utilisateurs individuels. Dans NestJS, implemente avec un decorateur `@Roles()` qui annote les endpoints et un `RolesGuard` qui vérifié le role de l'utilisateur authentifie.

### ReadableStream {#readablestream}
Type de stream Node.js qui produit des donnees a lire. Exemples : lecture de fichiers (`fs.createReadStream()`), requêtes HTTP entrantes (`req`), réponses HTTP (`res` cote client). Emet les événements `data`, `end`, `error`. Supporte les modes flowing et paused pour le controle du flux.

### Redis {#redis}
Base de donnees en mémoire clé-valeur, extremement rapide. Utilisee comme cache, broker de messages, store de sessions, et backend pour les files d'attente (BullMQ). Dans ce cours, Redis sert de backend pour les jobs queues, le rate limiting (`ThrottlerModule`) et le caching.

### Refresh Token {#refresh-token}
Token a longue duree de vie (jours/semaines) utilise pour obtenir un nouveau access token sans redemander les credentials. Stocke en base de donnees (hashé) et envoye via un cookie HttpOnly sécurisé ou dans le body. Permet d'avoir des access tokens a courte duree de vie (minutes) tout en maintenant la session utilisateur.

### Repository {#repository}
Pattern et classe TypeORM qui fournit des méthodes CRUD pour une entite spécifique : `find()`, `findOne()`, `save()`, `update()`, `delete()`. Obtenu dans NestJS via `@InjectRepository(Entity)`. Encapsule les operations de base de donnees et fournit une interface orientee objet pour les requêtes.

### REST {#rest}
Representational State Transfer : style d'architecture pour les API web. Principes : resources identifiees par des URL, operations via les méthodes HTTP (GET, POST, PUT, DELETE), communication stateless, representation des ressources en JSON. NestJS est optimise pour la construction d'API REST.

### Router {#router}
Objet Express qui permet de définir des routes modulaires et montables. `express.Router()` créé un mini-routeur avec ses propres middleware et routes, monte ensuite sur un chemin spécifique de l'application. Equivalent conceptuel des modules NestJS pour l'organisation des routes Express.

## S

### Scope {#scope}
Portee de vie d'un provider NestJS. Trois scopes : `DEFAULT` (singleton, une instance pour toute l'application), `REQUEST` (nouvelle instance par requête), `TRANSIENT` (nouvelle instance à chaque injection). Le scope par defaut est singleton, recommande pour les performances. Le scope REQUEST est utile pour les contextes par requête.

### Schema Prisma {#schema-prisma}
Fichier `schema.prisma` qui définit la source de donnees (PostgreSQL, MySQL, SQLite), le generateur (Prisma Client), et les modèles de donnees avec leurs relations. Source de verite unique pour le schema de la base de donnees. Les migrations et le client type-safe sont generes à partir de ce fichier.

### Serialization {#serialization}
Processus de transformation d'un objet en un format transmissible (JSON). Dans NestJS, la serialization est gérée par le `ClassSerializerInterceptor` qui utilise class-transformer pour exclure les champs sensibles (`@Exclude()`), renommer les propriétés (`@Expose()`) et transformer les valeurs avant l'envoi de la réponse.

### Service {#service}
Classe NestJS decoree avec `@Injectable()` qui encapsule la logique metier. Les services sont injectes dans les controllers via le constructeur. Ils gerent les operations de donnees, les calculs, les appels a des API externes, et toute logique qui n'appartient pas au controller. Un service par domaine fonctionnel est la convention.

### Socket.IO {#socket-io}
Bibliotheque qui fournit une communication bidirectionnelle en temps réel entre le client et le serveur. Basee sur WebSocket avec un fallback vers le long-polling HTTP. Integree dans NestJS via `@nestjs/platform-socket.io` et les decorateurs `@WebSocketGateway()`, `@SubscribeMessage()`.

### Stream {#stream}
Interface abstraite Node.js pour travailler avec des flux de donnees continus. Quatre types : Readable (lecture), Writable (écriture), Duplex (lecture/écriture), Transform (transformation). Les streams traitent les donnees par morceaux (chunks) plutot qu'en entier, ideal pour les gros volumes sans saturer la mémoire.

### supertest {#supertest}
Bibliotheque de test HTTP pour Node.js qui permet d'envoyer des requêtes à une application Express/NestJS et de vérifier les réponses. Syntaxe chainee : `request(app).get('/users').expect(200).expect('Content-Type', /json/)`. Utilisee dans les tests e2e NestJS pour tester les endpoints de l'API.

### Swagger {#swagger}
Specification OpenAPI et outils pour documenter les API REST. Dans NestJS, le module `@nestjs/swagger` généré automatiquement la documentation interactive à partir des decorateurs (`@ApiTags()`, `@ApiProperty()`, `@ApiResponse()`). Accessible via un endpoint (`/api/docs`) avec une interface graphique pour tester les endpoints.

## T

### ThrottlerModule {#throttlermodule}
Module NestJS (`@nestjs/throttler`) qui fournit le rate limiting au niveau de l'application. Configure avec `ThrottlerModule.forRoot({ ttl: 60, limit: 10 })` et active globalement via `ThrottlerGuard`. Protege l'API contre les abus en limitant le nombre de requêtes par IP dans une fenêtre de temps.

### Transform Stream {#transform-stream}
Type de stream Node.js qui modifie les donnees en transit entre une source Readable et une destination Writable. Implemente les méthodes `_transform(chunk, encoding, callback)` et optionnellement `_flush(callback)`. Exemples natifs : `zlib.createGzip()`, `crypto.createCipher()`. Utilise pour le traitement à la volee de flux de donnees.

### tsconfig {#tsconfig}
Fichier de configuration TypeScript (`tsconfig.json`) qui définit les options du compilateur : `target`, `module`, `strict`, `esModuleInterop`, `emitDecoratorMetadata`, `experimentalDecorators`. Le support des decorateurs et des metadonnees est essentiel pour NestJS. Souvent accompagne de `tsconfig.build.json` pour la production.

### TypeORM {#typeorm}
ORM pour TypeScript et JavaScript qui supporte les patterns Active Record et Data Mapper. Compatible avec PostgreSQL, MySQL, SQLite, MongoDB et d'autres. Utilise des decorateurs TypeScript pour définir les entites et les relations. Integre dans NestJS via `@nestjs/typeorm`.

### TypeOrmModule {#typeormmodule}
Module NestJS d'intégration TypeORM. `TypeOrmModule.forRoot()` configure la connexion globale à la base de donnees. `TypeOrmModule.forFeature([Entity])` enregistre les repositories d'entites dans un module spécifique. Supporte la configuration asynchrone avec `forRootAsync()` pour charger les credentials depuis `ConfigService`.

## U

### Unit Test {#unit-test}
Test qui vérifié le comportement d'une unite isolee de code (une fonction, un service) en mockant toutes ses dépendances. Dans NestJS, les tests unitaires utilisent `Test.createTestingModule()` avec des mocks des providers dependants. Rapides a exécuter et essentiels pour valider la logique metier.

## V

### ValidationPipe {#validationpipe}
Pipe intégré de NestJS qui valide automatiquement les donnees entrantes en utilisant class-validator et class-transformer. Configure globalement avec `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))`. L'option `whitelist` supprime les propriétés non decorees, `transform` convertit les types automatiquement.

## W

### WebSocket Gateway {#websocket-gateway}
Classe NestJS decoree avec `@WebSocketGateway()` qui géré les connexions WebSocket/Socket.IO. Les méthodes decorees avec `@SubscribeMessage('event')` gerent les événements entrants. Supporte les rooms, les broadcasts, les namespaces et les guards/pipes pour la validation et l'autorisation des messages en temps réel.

### WritableStream {#writablestream}
Type de stream Node.js qui consomme des donnees en écriture. Exemples : écriture de fichiers (`fs.createWriteStream()`), réponses HTTP (`res`), `process.stdout`. La méthode `write()` retourne un booleen indiquant si le buffer interne est plein (backpressure). L'événement `finish` signale la fin de l'écriture.

## Z

### Zod {#zod}
Bibliotheque TypeScript de validation et de parsing de schemas. Alternative a class-validator avec une approche "schema-first" plutot que "decorator-based". Integree dans NestJS via des pipes personnalises ou des adaptateurs. Avantage : inference automatique des types TypeScript depuis le schema de validation.

---

## Termes complementaires

### Express.static {#express-static}
Middleware Express intégré qui sert des fichiers statiques (HTML, CSS, JS, images) depuis un répertoire. Configure avec `app.use(express.static('public'))`. Gere automatiquement les en-tetes de cache, les types MIME et les fichiers index. A ne pas confondre avec le routage dynamique.

### Fastify {#fastify}
Framework web Node.js alternatif a Express, optimise pour la performance. Supporte le schema JSON pour la validation automatique, les plugins, et l'injection de dépendances. Peut remplacer Express comme adaptateur HTTP dans NestJS via `@nestjs/platform-fastify` pour de meilleures performances.

### Lifecycle Hooks {#lifecycle-hooks}
Interfaces NestJS qui permettent aux providers de reagir aux événements du cycle de vie de l'application : `OnModuleInit`, `OnModuleDestroy`, `OnApplicationBootstrap`, `OnApplicationShutdown`. Utiles pour initialiser des connexions au démarrage et les fermer proprement a l'arret.

### Microservices {#microservices}
Module NestJS (`@nestjs/microservices`) qui permet de construire des applications distribuees communiquant via des transports variés : TCP, Redis, RabbitMQ, Kafka, gRPC, NATS. Chaque microservice expose des message patterns et des event patterns au lieu de routes HTTP.

### RxJS {#rxjs}
Bibliotheque de programmation réactive utilisee en interne par NestJS pour les interceptors et les streams de donnees. Fournit les Observables, les operateurs (`map`, `tap`, `catchError`, `timeout`) et la gestion des flux asynchrones. Connaissance de base utile pour les interceptors NestJS avances.
