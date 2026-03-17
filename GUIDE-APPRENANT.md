# Guide de l'apprenant -- Backend Node.js / NestJS

> **Ce guide est ta boussole.** Tu vas traverser cinq couches du backend :
> Node.js brut, Express, NestJS, les ORM, et la production.
> Chaque couche construit sur la precedente -- ne saute pas d'etape.
>
> **Temps estime** : ~180-240h (5-7 mois a 8-10h/semaine)
>
> **Philosophie** : Le backend ne s'apprend pas dans un navigateur.
> Lance un terminal, execute du code, observe les logs.
> Si tu ne vois pas le serveur tourner, tu ne comprends pas vraiment.

---

## Avant de commencer -- Auto-diagnostic

### JavaScript -- le minimum vital

- [ ] Tu sais ecrire une Promise et utiliser `async`/`await`
- [ ] Tu comprends le concept de callback et pourquoi il existe
- [ ] Tu sais ce qu'est un objet JSON et comment le parser/serialiser
- [ ] Tu sais utiliser `try/catch` avec des operations asynchrones
- [ ] Tu as deja installe un package avec `npm` ou `yarn`

**5/5** -> Tu es pret pour Node.js. Attaque le module 00.
**3-4/5** -> Revise les bases async sur javascript.info (~2h), puis lance-toi.
**< 3/5** -> Fais d'abord un refresher JavaScript serieux. Le backend est 100% async.

### TypeScript -- fortement recommande

- [ ] Tu sais ecrire une interface et typer les parametres d'une fonction
- [ ] Tu sais ce qu'est un generic (`Promise<T>`, `Array<T>`)
- [ ] Tu comprends `unknown` vs `any`

**3/3** -> Parfait, NestJS sera naturel.
**1-2/3** -> Ca ira, mais fais le cours 01-typescript en parallele (au moins les phases 1-2).
**0/3** -> NestJS est ecrit en TypeScript. Sans bases TS, tu vas souffrir. Fais au moins les modules 00-06 du cours TypeScript d'abord.

### Backend -- ou en es-tu ?

- [ ] Tu as deja ecrit un serveur HTTP (dans n'importe quel langage)
- [ ] Tu sais ce qu'est une route, un middleware, un status code HTTP
- [ ] Tu as deja utilise un ORM ou ecrit du SQL
- [ ] Tu as deja deploye une application (meme sur Heroku ou Vercel)
- [ ] Tu as deja utilise Docker (meme juste `docker run`)

**5/5** -> Tu peux accelerer les Phases 1-2 et passer plus de temps sur NestJS.
**3-4/5** -> Tu as des bases. Les premieres phases iront vite.
**0-2/5** -> Parfait, tu es le public cible. On part de zero cote serveur.

### Le test decisif

Quelqu'un te dit "ecris un endpoint POST `/users` qui valide le body et retourne 201".
- Si tu sais le faire avec Express et un validateur -> commence a la Phase 3 (NestJS).
- Si tu sais ce que ca veut dire mais pas comment le coder -> commence a la Phase 2 (Express).
- Si "endpoint POST" te semble flou -> commence a la Phase 1 (Node.js), c'est fait pour.

---

## Les 5 phases de ta progression

### Phase 1 -- Node.js (modules 00-04) ~25-35h

> **Objectif** : Comprendre ce qui se passe SOUS Express et NestJS.
> L'event loop, les modules, les streams, le serveur HTTP natif.
>
> **Analogie** : Avant d'apprendre a conduire une F1 (NestJS),
> il faut comprendre comment un moteur fonctionne (Node.js).

| Module | Sujet | Temps | Note |
|---|---|---|---|
| 00 | Prerequis et monde backend | 2h | Le paysage backend JS -- context et motivation |
| 01 | Event loop | 3h | **Cours cle** -- si tu ne comprends pas l'event loop, tout le reste est flou |
| 02 | Modules et filesystem | 2h30 | `require` vs `import`, `fs`, `path` |
| 03 | Streams et buffers | 3h | Traiter des donnees sans tout charger en memoire |
| 04 | Serveur HTTP natif | 3h | `http.createServer` -- le fond du fond |

**Conseil** : Le module 01 (event loop) est crucial. Si tu ne comprends pas
pourquoi `setTimeout(fn, 0)` ne s'execute pas immediatement, relis-le.
Dessine le diagramme de l'event loop sur papier.

**Checkpoint Phase 1** :
- [ ] Tu sais expliquer l'event loop avec un dessin
- [ ] Tu sais lire et ecrire un fichier avec `fs` (callbacks ET promises)
- [ ] Tu sais creer un readable stream et le piper vers un writable
- [ ] Tu sais creer un serveur HTTP sans framework et router manuellement
- [ ] Tu comprends pourquoi Node.js est single-threaded et pourquoi ce n'est pas un probleme

> **Test** : "Pourquoi un `while(true)` bloque tout le serveur en Node.js ?"
> Si tu reponds "parce que ca bloque l'event loop et aucun callback ne peut s'executer", c'est bon.

---

### Phase 2 -- Express (modules 05-08) ~20-30h

> **Objectif** : Comprendre le modele middleware, la validation, l'authentification.
> Express est simple -- c'est sa force ET sa faiblesse.
>
> **Analogie** : Express est un couteau suisse. Pratique, flexible,
> mais tu dois tout assembler toi-meme. NestJS (Phase 3) te donnera un atelier complet.

| Module | Sujet | Temps | Note |
|---|---|---|---|
| 05 | Express fondamentaux | 3h | Routes, requete, reponse, JSON |
| 06 | Middleware | 3h | **Cours cle** -- le pattern qui structure tout Express |
| 07 | Validation et erreurs | 3h | Zod/Joi, error handling centralize |
| 08 | Auth et securite | 3h | JWT, bcrypt, CORS, helmet |

**Conseil** : Quand tu codes avec Express, resiste a la tentation de chercher
"le bon pattern". Express n'impose rien -- et c'est le probleme que NestJS resout.

**Checkpoint Phase 2** :
- [ ] Tu sais creer une API CRUD complete avec Express
- [ ] Tu sais ecrire un middleware custom (logging, auth, error handler)
- [ ] Tu sais valider un body de requete et retourner des erreurs propres (400, 422)
- [ ] Tu sais implementer une auth JWT (login, middleware de verification)
- [ ] Tu comprends pourquoi Express seul ne suffit pas pour un gros projet

> **Test** : "Un middleware Express recoit `(req, res, next)`. A quoi sert `next()` ?"
> Si tu reponds "a passer au middleware suivant dans la pile, et si tu ne l'appelles pas la requete reste en suspens", c'est bon.

---

### Phase 3 -- NestJS (modules 09-13) ~35-45h

> **Objectif** : Maitriser le framework qui structure tout.
> Controllers, providers, DI, modules, pipes, guards, interceptors.
>
> **Analogie** : Si Express est un terrain vague ou tu construis ce que tu veux,
> NestJS est un immeuble avec des plans d'architecte. Tu gagnes en structure
> ce que tu perds en "liberte" (et c'est exactement le but).

| Module | Sujet | Temps | Note |
|---|---|---|---|
| 09 | Introduction a NestJS | 3h | CLI, structure, decorateurs, premier CRUD |
| 10 | Controllers | 3h | Routes, parametres, DTOs, status codes |
| 11 | Providers et DI | 4h | **Cours cle** -- l'injection de dependances change tout |
| 12 | Modules | 3h | Organisation, imports/exports, modules dynamiques |
| 13 | Pipes, guards, interceptors | 4h | **Cours cle** -- le pipeline de requete NestJS |

**Attention** : Le module 11 (DI) est le tournant. Si l'injection de dependances
te semble abstraite, c'est normal. Ecris le code, observe ce qui est injecte ou,
et ca deviendra concret. Ne lis pas seulement -- `nest generate` et execute.

**Checkpoint Phase 3** :
- [ ] Tu sais creer un module NestJS avec controller + service + DTOs
- [ ] Tu comprends le cycle de vie d'une requete (pipe -> guard -> interceptor -> handler)
- [ ] Tu sais injecter un service dans un autre avec `@Injectable()`
- [ ] Tu sais creer un guard d'authentification custom
- [ ] Tu sais utiliser un pipe de validation avec `class-validator`

> **Test** : "Quelle est la difference entre un middleware Express et un interceptor NestJS ?"
> Si tu reponds que l'interceptor a acces au contexte d'execution et peut transformer
> la reponse (pas juste la requete), c'est bon.

---

### Phase 4 -- ORM et donnees (modules 14-17) ~25-35h

> **Objectif** : Connecter ton API a une base de donnees.
> TypeORM, Prisma, migrations, relations, requetes avancees.
>
> **Analogie** : Jusqu'ici tu construisais des routes qui retournaient du JSON en dur.
> Maintenant tu branches le moteur sur une vraie base de donnees.

| Module | Sujet | Temps | Note |
|---|---|---|---|
| 14 | TypeORM -- entites et relations | 4h | Entities, OneToMany, ManyToMany |
| 15 | TypeORM -- requetes et migrations | 3h | QueryBuilder, migrations, seeds |
| 16 | Prisma -- schema et client | 3h | **Alternative a TypeORM** -- schema-first, DX moderne |
| 17 | Prisma avance et comparaison | 3h | Relations, transactions, TypeORM vs Prisma |

**Conseil** : Ne te stresse pas sur "TypeORM ou Prisma ?". Apprends les deux.
En entreprise, tu tomberas sur l'un ou l'autre. Ce qui compte c'est de comprendre
le concept d'ORM, pas de choisir un camp.

**Checkpoint Phase 4** :
- [ ] Tu sais definir un schema de base de donnees avec des relations
- [ ] Tu sais ecrire et executer des migrations
- [ ] Tu sais faire un CRUD complet via un ORM (create, findMany avec filtres, update, delete)
- [ ] Tu sais gerer une transaction (tout reussit ou tout echoue)
- [ ] Tu sais expliquer les avantages et inconvenients de TypeORM vs Prisma

> **Test** : "Un dev fait `await repo.save(entity)` dans une boucle de 1000 elements. Quel est le probleme ?"
> Si tu reponds "1000 requetes SQL au lieu d'un batch insert, il faut utiliser `save([...entities])` ou une transaction", c'est bon.

---

### Phase 5 -- Production (modules 18-26) ~50-70h

> **Objectif** : Tout ce qui fait qu'une API NestJS tient en production.
> Tests, auth avancee, config, WebSockets, jobs, performance, deploiement.
>
> **Analogie** : Tu as construit la maison. Maintenant tu installes
> l'alarme, l'isolation, le chauffage, et tu fais le menage.

| Module | Sujet | Temps | Note |
|---|---|---|---|
| 18 | Testing NestJS | 4h | **Cours cle** -- tests unitaires, integration, e2e |
| 19 | Auth avancee | 3h | Passport, sessions, OAuth2, RBAC |
| 20 | Config et Swagger | 3h | `.env`, ConfigModule, documentation auto |
| 21 | WebSockets et fichiers | 3h | Temps reel, upload/download |
| 22 | Jobs et queues | 3h | BullMQ, taches en arriere-plan |
| 23 | Performance et deploiement | 3h | Cache, compression, clustering, Docker |
| 24 | Projet final | 8h+ | Une API complete de A a Z |
| 25 | MongoDB et Mongoose | 3h | Alternative NoSQL |
| 26 | GraphQL avec NestJS | 3h | Alternative a REST |

**Conseil** : Le module 18 (testing) est non-negociable. Un backend sans tests,
c'est un chateau de cartes. Fais-le AVANT les modules fun (WebSockets, GraphQL).

**Checkpoint Phase 5** :
- [ ] Tu sais ecrire des tests unitaires pour un service NestJS
- [ ] Tu sais ecrire un test e2e avec `supertest`
- [ ] Tu sais configurer Swagger pour documenter ton API automatiquement
- [ ] Tu sais mettre en place une queue de jobs asynchrones
- [ ] Tu as deploye une API NestJS (Docker, ou cloud, ou meme en local avec PM2)
- [ ] Tu as termine le projet final avec au moins 80% de couverture de tests

> **Test** : "Comment tu structures une API NestJS avec 15 modules metier ?"
> Si tu parles de modules NestJS, de separation domaine/infra, de DTOs partages
> via un module `common`, et de tests par module -- tu es pret pour la production.

---

## Quand tu bloques

### "NestJS ne trouve pas mon service / provider"
1. Verifie que le service est dans le `providers` array de son module
2. Verifie que le module est importe par le module qui en a besoin
3. Verifie que le service a bien `@Injectable()`
4. Si c'est un module dynamique, verifie le `forRoot()` / `forFeature()`

### "L'injection de dependances me perd"
1. Dessine un schema : Module A -> importe Module B -> utilise Service B
2. Pense aux modules comme des boites : chaque boite declare ce qu'elle exporte
3. Un service non exporte est PRIVE a son module -- c'est voulu, pas un bug

### "Mes tests NestJS sont un cauchemar"
1. Commence par tester le service SANS le controller (test unitaire pur)
2. Utilise `Test.createTestingModule` avec des mocks manuels, pas la vraie DB
3. Les tests e2e viennent APRES les tests unitaires, pas avant
4. Si tu mock trop de choses, c'est un signe que ton code est trop couple

### "Mon ORM genere des requetes bizarres"
1. Active les logs SQL (`logging: true` dans TypeORM, `log: ['query']` dans Prisma)
2. Lis la requete generee -- c'est souvent un `SELECT *` ou un N+1
3. Utilise `relations` (TypeORM) ou `include` (Prisma) explicitement
4. En dernier recours, ecris du SQL brut -- un ORM n'est pas une obligation

### "Mon serveur crash au demarrage"
1. Lis le message d'erreur EN ENTIER, pas juste la derniere ligne
2. Cherche "Cannot find module" -> probleme d'import ou de build
3. Cherche "Nest can't resolve dependencies" -> probleme de DI (voir ci-dessus)
4. Cherche "EADDRINUSE" -> un autre processus utilise deja le port

### "Je ne comprends pas le cycle de vie d'une requete"
1. Ajoute un `console.log` dans : un middleware, un guard, un interceptor, un pipe, et le handler
2. Fais une requete et observe l'ordre des logs
3. C'est la meilleure facon de comprendre -- la theorie ne suffit pas

---

## Auto-evaluation globale

**Apres Phase 1** : "Qu'est-ce qui se passe quand tu tapes `node server.js` ?"
-> Si tu expliques le chargement du fichier, l'event loop qui demarre, le `listen` qui enregistre un callback sur un port, c'est bon.

**Apres Phase 2** : "Pourquoi Express ne suffit pas pour un gros projet ?"
-> Si tu parles d'absence de structure imposee, de DI manuelle, de testing penible sans framework, c'est bon.

**Apres Phase 3** : "Qu'est-ce que l'injection de dependances et pourquoi c'est important ?"
-> Si tu reponds "decoupler les composants pour pouvoir les tester et les remplacer independamment", c'est bon.

**Apres Phase 4** : "Quand utiliser du SQL brut plutot qu'un ORM ?"
-> Si tu parles de requetes complexes, de performance critique, ou de features non supportees par l'ORM, c'est bon.

**Apres Phase 5** : "Ton API NestJS est en prod et un endpoint met 3 secondes. Par ou tu commences ?"
-> Si tu parles de monitoring/logs, puis profiling de la requete SQL, puis cache, c'est bon.

---

## Rythme recommande

| Rythme | Par semaine | Duree totale |
|---|---|---|
| **Decouverte** (a cote du boulot) | 5-7h | 7-8 mois |
| **Regulier** (motivation) | 8-10h | 5-6 mois |
| **Intensif** (reconversion) | 15-20h | 3-4 mois |

### Conseils concrets

- **Phases 1-2 : 3-4 semaines max.** Ce sont des bases, pas le coeur. Ne t'y eternise pas.
- **Phase 3 : prends ton temps.** C'est le coeur du cours. 4-6 semaines minimum.
- **Phase 4 : fais les deux ORM.** Meme si tu preferes l'un, apprends l'autre.
- **Phase 5 : le testing d'abord.** Module 18 avant tout le reste.
- **Le projet final (24) merite 2-3 semaines.** C'est ton portfolio backend.
- **Execute TOUJOURS le code.** `npm run start:dev` doit etre ta commande reflexe.

### L'erreur classique

Ne fais PAS ca : lire tout le cours NestJS, puis essayer de coder.
Fais plutot : lis UN module, code l'exercice, lis le module suivant.
Le backend s'apprend les mains dans le terminal.

---

## Ressources complementaires

### References essentielles
- [NestJS Documentation](https://docs.nestjs.com) -- excellente, lis-la comme un roman
- [Prisma Documentation](https://www.prisma.io/docs) -- claire et interactive
- [Node.js Documentation](https://nodejs.org/docs/latest/api/) -- pour les modules natifs

### Pour approfondir
- *Node.js Design Patterns* (Casciaro, Mammino) -- le livre de reference Node.js
- *NestJS in Action* -- patterns avances et architecture
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-security.html) -- securite Express

---

## Et apres ?

Tu as fini les 27 modules ? Tu peux construire et deployer une API backend complete.

Prochaines etapes :
1. **Apprends PostgreSQL en profondeur** (cours 06) -- un bon dev backend maitrise sa BDD
2. **Explore l'architecture** (cours 10) -- passer de "je code une API" a "je conçois un systeme"
3. **Contribue a un projet open source NestJS** -- rien ne t'apprend plus que de lire le code des autres
4. **Construis un side project complet** -- API + front + deploiement + monitoring
