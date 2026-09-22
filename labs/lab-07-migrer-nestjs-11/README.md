# Lab 07 — Intervention : migrer une app NestJS ^10 vers 11 (et réparer ce qu'on découvre en route)

> **Outcome :** à la fin, tu as fait ce que fait une vraie mission de maintenance : bump une
> stack figée depuis longtemps, corriger ce qui casse, et **découvrir au passage un bug de
> configuration qui dormait depuis toujours** (les tests unitaires de ce projet n'ont
> probablement JAMAIS tourné en CI — tu vas voir pourquoi, et ce n'est pas lié à la migration).
> Migrer, ce n'est jamais neutre : ça révèle ce qu'on ne vérifiait plus.
> **Vrai outil :** NestJS **11.2.5**, Jest **30.5.2**, ts-jest **29.4.12**, TypeScript **6.0.3**,
> supertest **7.3.0** — les mêmes versions que les labs 01-06 de ce cours.
> **Feedback :** `npm run lab:07` (depuis `09-nestjs/labs`) — les DEUX suites (unitaire et e2e)
> doivent être vertes, ET réellement exécutées (pas juste « aucune erreur » parce que rien n'a
> tourné). `npm run solution:07` prouve l'oracle sur la référence déjà migrée.

## Structure particulière de ce lab

Contrairement aux autres labs d'intervention, il y a ici **deux dossiers indépendants**, chacun
avec son propre `package.json` et son propre `node_modules` :

- `starter/` — **c'est celui que tu modifies.** Copie exacte du lab historique
  `09-nestjs/labs/lab-18-testing`, figée sur NestJS `^10`, Jest `^29`, TypeScript `^5.3`.
- `solution/` — référence déjà migrée, en lecture seule, pour prouver que l'oracle est sain.

Pourquoi deux dossiers et pas un swap de fichiers comme les autres labs d'intervention : ici,
**les dépendances elles-mêmes** font partie de ce qui change — un simple swap de fichiers ne
suffit pas, il faut un `node_modules` cohérent avec chaque état.

## Énoncé

**Étape 0 — avant de toucher à quoi que ce soit**, dans `starter/` :

```bash
cd 09-nestjs/labs/lab-07-migrer-nestjs-11/starter
npm install
npx jest --config jest.config.ts
npx jest --config jest-e2e.config.ts
```

Note ce que tu observes dans `FINDINGS.md` (à créer dans `starter/`). L'e2e passe. L'unitaire…
regarde bien le message. C'est un vrai réflexe de mission : on ne migre jamais à l'aveugle, on
part d'un état de référence compris.

**Étape 1 — la migration.** Dans `starter/package.json`, remplace les versions de
`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/testing`, `jest`,
`ts-jest`, `typescript`, `supertest`, `@types/jest`, `@types/supertest` par les versions
indiquées en tête de ce README. `npm install` à nouveau.

**Étape 2 — corrige ce qui casse.** Il y a **au moins trois problèmes distincts**, dans cet
ordre d'apparition probable :
1. Un import `supertest` qui ne compile plus (indice : compare le style d'import de
   `test/users.e2e-spec.ts` à celui des labs 01, 05, 06 de ce cours).
2. Les types Jest introuvables au typecheck (indice : les labs 01-06 ont tous un champ
   `"types"` dans leur `tsconfig.json` — celui-ci ne l'a pas).
3. Le bug de configuration découvert à l'étape 0 — maintenant que tu veux vraiment que les
   DEUX suites tournent, il n'est plus possible de l'ignorer.

Ne devine pas : lance les tests, lis l'erreur exacte, corrige un problème à la fois, relance.

## Vérifier

```bash
cd 09-nestjs/labs
npm install               # dépendances partagées du cours (aucun effet sur ce lab)
npm run lab:07             # teste starter/ — installe d'abord ses propres deps, voir plus haut
npm run solution:07        # teste solution/ — installe d'abord ses propres deps (cd solution && npm install)
```

**Ce que l'oracle vérifie**

Que `jest --config jest.config.ts` **trouve et fait passer** les 6 tests unitaires de
`UsersService` (`findAll`, `create`, `findOne`, `findOne` inconnu → `NotFoundException`,
`update`, `remove`) — pas zéro test trouvé, un vrai GREEN sur un vrai run. Que
`jest --config jest-e2e.config.ts` fait passer les 6 tests e2e existants (POST, GET liste, GET
un, 404, PATCH, DELETE).

## Variante J+30 (fading)

Le ticket suivant : « et si on passait à NestJS 12 ? » Tente la bascule (`12.0.4` pour
`@nestjs/common`/`core`/`platform-express`/`testing`) dans une copie de `starter/`, observe ce
qui casse, et écris dans `FINDINGS.md` pourquoi ce cours s'arrête à la version 11 pour
l'instant — tu as déjà la réponse, elle est dans les notes d'adaptation des labs 02 et 03.

## Application TribuZen

Le même exercice, en vrai, sur `tribuzen-api` le jour venu. Commit :
`chore(deps): NestJS 10 → 11, Jest 29 → 30 — fix config rootDir jamais exécutée en CI`.
