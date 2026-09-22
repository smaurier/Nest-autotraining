# Lab 01 — Une API TribuZen de bout en bout, depuis un dossier vide

> **Outcome :** à la fin, tu as construit **toute une verticale** — module, DTO validés, guard,
> service (règles métier), repository (stockage) — testée à deux niveaux (unitaire avec
> dépendances mockées, e2e avec la vraie app et de vraies requêtes HTTP), jusqu'au moment où
> `curl` obtient une vraie réponse. C'est le geste NestJS complet, pas un concept isolé
> (pipe ici, guard là) : les huit fichiers que tu écris collaborent, comme en vrai.
> **Vrai outil :** NestJS **11.2.5**, `class-validator`/`class-transformer`, Jest 30 + ts-jest,
> supertest. Aucun harnais simulé.
> **Feedback :** `npm run lab:01` (depuis `09-nestjs/labs`) — deux couches dans l'ordre :
> unitaire d'abord (rapide), e2e ensuite. RED tant que `src/families/` n'est pas écrit.
> `npm run solution:01` prouve l'oracle sur les deux couches.

## Note d'adaptation (versions)

Le corpus du cours cite NestJS ^10 (lab-18 historique). La version courante au 22/09/2026 est
**NestJS 12**, mais NestJS 12 est publié en **ESM pur** (`"type": "module"`) — incompatible avec
`ts-jest` en l'état (CommonJS). Ce lab utilise donc **NestJS 11.2.5** (dernière version CJS),
le compromis réel qu'on ferait en mission avant que l'outillage de test rattrape l'écosystème.
De même, **TypeScript est fixé à 6.0.3** ici (pas 7, comme les autres labs) : `ts-jest`
n'accepte pas encore TypeScript 7 (`peerDependency: "typescript": ">=4.3 <7"`). Vérifie toujours
la compatibilité de ta chaîne d'outils avant d'épingler une version « la plus récente ».

## Lire avant (une lecture bornée)

- Module [`10-nestjs-controllers.md`](../../modules/10-nestjs-controllers.md) et
  [`11-nestjs-providers-di.md`](../../modules/11-nestjs-providers-di.md) — le strict nécessaire :
  `@Controller`, `@Injectable`, injection par constructeur.
- Module [`13-nestjs-pipes-guards-interceptors.md`](../../modules/13-nestjs-pipes-guards-interceptors.md) — `CanActivate`, `@UseGuards`, et pourquoi un Guard renvoie `false` plutôt que de lever.
- Module [`18-nestjs-testing.md`](../../modules/18-nestjs-testing.md) — `Test.createTestingModule`, `useValue` pour mocker une dépendance, la différence unitaire/e2e.

## Énoncé

Deux fichiers te sont donnés (bootstrap standard, `src/main.ts` et `src/app.module.ts`) — tu ne
les modifies pas. Tu écris **tout** `src/families/` :

- `dto/create-family.dto.ts`, `dto/add-member.dto.ts` — DTO validés par `class-validator`
  (`@IsString`, `@IsNotEmpty`, `@IsEmail`, `@IsIn`).
- `api-key.guard.ts` — `ApiKeyGuard`, exporte aussi `API_KEY` (valeur `"dev-key"`). Vérifie
  l'en-tête `x-api-key`. Un Guard renvoie `false`, il ne lève pas — sinon Nest répond 500, pas 403.
- `families.repository.ts` — stockage en mémoire (`Map`), zéro règle métier ici.
- `families.service.ts` — les règles : famille introuvable → `NotFoundException` ; email déjà
  membre (insensible à la casse) → `ConflictException` ; 21e membre → `BadRequestException`
  (quota 20).
- `families.controller.ts` — routes fines, tout délégué au service.
- `families.module.ts` — assemble le tout.

## Étapes (en friction)

1. DTO d'abord (c'est ce que Nest valide avant même d'atteindre ton code).
2. `families.repository.ts` — juste du stockage, pas de règle.
3. `families.service.ts` — les quatre règles, une à une, dans l'ordre où le test unitaire les
   attend (relis `test/families.service.spec.ts`, c'est ton oracle, pas un mystère).
4. `api-key.guard.ts`.
5. `families.controller.ts` puis `families.module.ts` — sans ces deux-là, rien ne démarre.
6. `npm run lab:01` — couche unitaire d'abord. Une fois verte, la couche e2e se lance seule.

## Vérifier

```bash
cd 09-nestjs/labs
npm install       # une fois
npm run lab:01
npm run check:01
```

**Ce que l'oracle vérifie**

Unitaire (10 cas) : le service délègue au repository, les trois exceptions dans les bonnes
conditions (avec repository **mocké**, jamais le vrai stockage), le Guard autorise/refuse selon
l'en-tête. E2E (8 cas, vraie app + supertest) : `POST /families` crée (201) et rejette un `name`
vide (400, ValidationPipe) ; `POST /families/:id/members` sans clé → 403, avec la bonne clé →
201, email invalide → 400, role hors énumération → 400, doublon → 409 ; `GET` sur une famille
inconnue → 404.

## Variante J+30 (fading)

Ajoute une route `DELETE /families/:id/members/:memberId`, protégée par le même Guard, qui lève
`NotFoundException` si le membre n'existe pas. Écris d'abord le test e2e, puis le test unitaire
du service, puis implémente — dans cet ordre, sans revoir ce README.

## Application TribuZen

Même verticale sur `tribuzen-api/src/families/`. Commit :
`feat(families): API complète — DTO, guard, service, repository, tests unit+e2e`.
