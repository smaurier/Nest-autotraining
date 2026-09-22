# Lab 06 — Intervention : reproduire puis corriger une faille d'autorisation

> **Outcome :** à la fin, tu sais reconnaître et corriger une **Broken Object Level
> Authorization** (OWASP API Security Top 10, catégorie #1) — la faille la plus fréquente des
> API réelles : vérifier qu'un appelant est authentifié n'est PAS la même chose que vérifier
> qu'il a le droit sur CETTE ressource précise. Tu reproduis la faille (elle existe vraiment,
> pas hypothétique), tu la corriges, tu prouves que le comportement légitime survit.
> **Vrai outil :** NestJS 11.2.5, supertest, Jest 30.
> **Feedback :** `npm run lab:06` — `regression.e2e-spec.ts` (comportement légitime, déjà
> vert) + `faille.e2e-spec.ts` (rouge — la faille est réelle — puis vert). `npm run
> solution:06` prouve l'oracle.

## Lire avant (une lecture bornée)

- Module [`08-express-auth-securite.md`](../../modules/08-express-auth-securite.md) —
  authentification (qui es-tu) vs autorisation (as-tu le droit), et pourquoi confondre les
  deux est la faille la plus commune en API.
- Ton propre `jwt-auth.guard.ts` du lab 02 : ce lab te montre exactement ce qu'un Guard
  d'authentification **ne prouve pas** — il prouve une identité, jamais un droit sur un objet.

## Note d'adaptation

Ce lab isole la question de l'**autorisation** de celle de l'**authentification** (déjà
travaillée au lab 02). L'en-tête `x-user-id` représente une identité déjà vérifiée en amont
par un vrai Guard JWT — tu la traites comme une donnée de confiance, ce n'est pas le sujet ici.

## Énoncé

Ticket de sécurité reçu : *« n'importe quel utilisateur connecté peut supprimer le post de
n'importe qui d'autre, il suffit de connaître son id. »*

Ouvre `src/posts/posts.controller.ts`. La méthode `remove` vérifie que le post existe
(`getById` lève déjà `NotFoundException` sinon), et vérifie — implicitement — que l'appelant
est authentifié (l'en-tête est là). Elle NE vérifie PAS que l'appelant est bien **l'auteur** du
post. C'est exactement la faille rapportée.

**Ta mission** : modifie `posts.controller.ts`, uniquement, pour que seul l'auteur d'un post
puisse le supprimer. Sinon → `403 Forbidden`, et le post reste intact.

## Étapes (en friction)

1. Lance `npm run lab:06`. Lis `faille.e2e-spec.ts` : c'est la reproduction exacte du ticket,
   déjà écrite — regarde-la échouer, comprends pourquoi (bob supprime le post d'alice).
2. Récupère le `post` (tu l'as déjà via `getById`, ne rappelle pas le repository).
3. Compare `post.authorId` à `userId` (l'en-tête). Si différent → `ForbiddenException`.
4. Relance `npm run lab:06`.

## Vérifier

```bash
cd 09-nestjs/labs
npm install
npm run lab:06
npm run check:06
```

**Ce que l'oracle vérifie**

Non-régression (3 cas) : lecture publique inchangée, 404 sur id inconnu (lecture et
suppression). Faille (3 cas) : l'auteur supprime son propre post (204, vraiment supprimé,
vérifié par un GET qui suit) ; un autre utilisateur ne peut pas supprimer le post d'alice (403,
**le post survit** — vérifié) ; symétrique pour bob.

## Variante J+30 (fading)

Le même ticket, mais pour `PATCH /posts/:id` (modifier le contenu, pas encore implémenté).
Écris d'abord le test qui reproduit la même classe de faille sur cette nouvelle route, puis
implémente la route ET sa protection en même temps — ne les sépare jamais.

## Application TribuZen

Même correction sur `tribuzen-api/src/posts/posts.controller.ts`. Commit :
`fix(posts): autorisation au niveau de l'objet sur DELETE — IDOR corrigé`.
