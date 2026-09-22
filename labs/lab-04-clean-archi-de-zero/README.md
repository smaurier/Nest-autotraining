# Lab 04 — Clean Architecture de zéro : domain, application, infrastructure

> **Outcome :** à la fin, tu as construit une verticale en trois couches où **les dépendances
> pointent vers l'intérieur** : `infrastructure` dépend de `application` qui dépend de `domain`,
> jamais l'inverse. Tu le PROUVES, pas seulement tu l'affirmes : le test du domaine n'importe
> rien de NestJS, le test de l'application utilise un FAUX port (jamais l'implémentation
> concrète), seul le test e2e connaît le vrai câblage. Ce sont les « tests de frontière » —
> chacun vérifie qu'une couche respecte son contrat avec celle du dessous.
> **Vrai outil :** NestJS 11.2.5, `class-validator`, Jest 30, supertest.
> **Feedback :** `npm run lab:04` — trois frontières dans l'ordre, la plus interne (domaine)
> en premier. `npm run solution:04` prouve l'oracle sur les trois.

## Lire avant (une lecture bornée)

- Module [`12-nestjs-modules.md`](../../modules/12-nestjs-modules.md) — l'injection par jeton
  (`@Inject(TOKEN)`), utile quand on injecte une interface plutôt qu'une classe concrète.
- Cours [`13-architecture`](../../../13-architecture/) si tu l'as déjà entamé — sinon, ce lab
  EST ta première vraie rencontre avec Clean/Hexagonal : le cours 08 du parcours reviendra
  dessus en profondeur, ce lab en donne le geste minimal et fonctionnel.
- Module [`11-nestjs-providers-di.md`](../../modules/11-nestjs-providers-di.md) — DI par
  constructeur, prérequis pour comprendre pourquoi le port se branche dans le module et nulle
  part ailleurs.

## Énoncé

Le domaine : une routine familiale (« brossage de dents ») a une **streak** — le nombre de jours
consécutifs où elle a été faite. Tu construis ça en trois couches :

1. **`domain/`** (le cœur, zéro dépendance externe) :
   - `streak.ts` — `calculerStreak(completions: Date[], today: Date): number`, une fonction
     **pure**. Règle : streak vivante si aujourd'hui OU hier est fait ; un jour sauté au milieu
     arrête le décompte à cet endroit, sans jamais le sauter.
   - `routine.repository.port.ts` — l'interface `RoutineRepositoryPort` (le contrat que
     l'application utilisera) + le jeton d'injection `ROUTINE_REPOSITORY` (une interface
     n'existe plus au runtime ; NestJS a besoin d'un `Symbol` pour l'injecter).

2. **`application/`** (orchestre, ne connaît que le port) :
   - `complete-routine.usecase.ts` — `CompleteRoutineUseCase.execute(routineId, today)` :
     vérifie que la routine existe, ajoute la complétion du jour (idempotent), calcule et
     renvoie la streak.

3. **`infrastructure/`** (les détails techniques, remplaçables) :
   - `in-memory-routine.repository.ts` — implémente le port, en mémoire, pré-rempli avec une
     routine `"brossage"`.
   - `dto/complete-routine.dto.ts`, `routines.controller.ts`, `routines.module.ts` — HTTP.

**La ligne qui compte le plus** dans tout le lab : dans `routines.module.ts`,
`{ provide: ROUTINE_REPOSITORY, useClass: InMemoryRoutineRepository }`. C'est elle qui
matérialise l'inversion de dépendance. Le jour où tu remplaces le stockage en mémoire par
PostgreSQL, **seule cette ligne et le nouveau fichier infrastructure changent** — `domain/` et
`application/` ne bougent pas d'un caractère.

## Étapes (en friction)

1. `streak.ts` — page blanche, teste-le mentalement à la main sur 2-3 cas avant de coder.
2. `routine.repository.port.ts` — juste des types et un `Symbol`.
3. `complete-routine.usecase.ts` — le SEUL fichier hors `infrastructure/` qui importe NestJS
   (`@Injectable`, `@Inject`, `NotFoundException`) : une simplification pragmatique assumée
   (voir note ci-dessous), pas une porte ouverte à tout importer n'importe où.
4. `in-memory-routine.repository.ts`, puis le DTO, le controller, le module.
5. `npm run lab:04` — la frontière domaine d'abord ; si elle échoue, inutile d'aller plus loin.

## Note d'adaptation

Une Clean Architecture à la lettre isolerait `application/` de NestJS aussi (les exceptions
seraient des classes maison, traduites en HTTP dans `infrastructure/` seulement). Ce lab
tolère `NotFoundException` dans le use case : c'est le compromis pragmatique que font la
plupart des équipes NestJS en pratique — la rigueur totale a un coût de ceremony que ce lab
ne juge pas pédagogique d'imposer ici. Ce qui compte, non négociable : `domain/` reste à zéro
dépendance, et `application/` ne connaît jamais une classe concrète d'infrastructure.

## Vérifier

```bash
cd 09-nestjs/labs
npm install
npm run lab:04
npm run check:04
```

**Ce que l'oracle vérifie**

Domaine (7 cas, zéro NestJS) : vide → 0, aujourd'hui seul → 1, trois jours d'affilée → 3, streak
« encore vivante » sans complétion aujourd'hui, streak brisée après 3 jours de silence, un trou
au milieu arrête le décompte, les doublons ne comptent qu'une fois. Application (4 cas, faux
port) : 404 si routine absente, complétion + streak, idempotence (pas de doublon le même jour),
la streak reflète l'historique déjà présent. E2E (5 cas, vrai câblage) : streak qui monte sur
des jours consécutifs, streak qui retombe à 1 après un jour sauté, 404, 400 sur un format de
date invalide.

## Variante J+30 (fading)

Ajoute une deuxième implémentation du port, `FileRoutineRepository` (persiste dans un fichier
JSON local), et bascule le module dessus **sans toucher à `domain/` ni `application/`**. Si tu
dois modifier autre chose que `infrastructure/`, c'est que l'inversion de dépendance n'était
pas complète — reviens en arrière et trouve où.

## Application TribuZen

`tribuzen-api/src/routines/{domain,application,infrastructure}/`. Commit :
`feat(routines): streak de routine — Clean Architecture, tests de frontière`.
