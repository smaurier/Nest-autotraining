# Lab 08 — Intervention : relire une PR API, findings avant vérité

> **Outcome :** à la fin, tu sais repérer dans une PR d'API deux failles très fréquentes et
> souvent invisibles à une revue rapide : la **sur-affectation de masse** (mass assignment —
> un DTO trop permissif laisse le client modifier des champs qu'il ne devrait jamais toucher,
> comme son propre rôle) et la **fuite de données sensibles** (une réponse HTTP qui renvoie
> l'objet interne complet, hash de mot de passe compris).
> **Vrai outil :** NestJS 11.2.5, `class-validator`, supertest, Jest 30.
> **Feedback :** `npm run lab:08` — `regression.e2e-spec.ts` (comportement légitime, déjà vert)
> + `pr-review.e2e-spec.ts` (rouge — les deux problèmes sont réels — puis vert). `npm run
> solution:08` prouve l'oracle.

## Lire avant (une lecture bornée)

- Module [`07-express-validation-erreurs.md`](../../modules/07-express-validation-erreurs.md) —
  `whitelist`/`forbidNonWhitelisted` du `ValidationPipe`, et pourquoi un DTO **est** la
  frontière de sécurité, pas un détail de confort.
- Ton lab 06 : même famille de problème (autorisation), mais au niveau de l'**objet entier**
  (« puis-je toucher CE post »). Ici, c'est au niveau du **champ** (« puis-je toucher CE
  champ précis de CET objet »).

## Énoncé

Un collègue ouvre une PR : `PATCH /users/:id/profile`, pour que les utilisateurs éditent leur
nom et leur bio. Elle semble fonctionner, la démo passe. Avant de l'approuver :

**0. Findings d'abord.** Sans lancer l'oracle, lis dans l'ordre `src/users/dto/update-profile.dto.ts`,
`src/users/users.service.ts`, `src/users/users.controller.ts`. Écris `REVIEW.md` à la racine du
lab et réponds :
- Le DTO a un champ `role`. Qui, dans le code, vérifie que seul un admin a le droit de le
  poser ? (Regarde vraiment — ne suppose pas.)
- `updateProfile` construit `{ ...user, ...dto }` puis renvoie le résultat tel quel au client.
  Quels champs de `User` (regarde `user.model.ts`) un client peut-il voir dans la réponse qu'il
  ne devrait JAMAIS voir ?
- Ces deux problèmes portent des noms précis en sécurité applicative (mass assignment /
  excessive data exposure, OWASP API Security Top 10). Nomme-les.

Le correcteur-labs lit `REVIEW.md` avant de juger — un GREEN sans ce fichier n'est pas un GO.

**1. Corrige.** Modifie **deux fichiers**, en place :
- `dto/update-profile.dto.ts` — retire `role`. Une route de gestion des rôles, si elle existe
  un jour, sera séparée et réservée aux admins.
- `users.service.ts` — ne renvoie plus jamais `passwordHash` (ni aucun champ hors d'une liste
  blanche explicite que tu définis).

## Vérifier

```bash
cd 09-nestjs/labs
npm install
npm run lab:08
npm run check:08
```

**Ce que l'oracle vérifie**

Non-régression (3 cas) : `name`/`bio` se mettent à jour, id inconnu → 404, `id`/`email` ne
bougent jamais. Findings (2 cas) : envoyer `role: "admin"` ne fait JAMAIS passer le rôle à
`"admin"` (rejeté ou ignoré, les deux choix sont recevables) ; la réponse ne contient jamais
`passwordHash`, ni sa valeur en clair.

## Variante J+30 (fading)

Un troisième champ sensible existe dans `User` mais n'est pas encore exploité par la PR :
imagine que quelqu'un ajoute `internalNotes: string` (notes d'équipe support, jamais destinées
à l'utilisateur) au modèle. Sans relire ce README, écris le test qui prouverait qu'il ne fuit
jamais — avant même qu'il existe dans le code. C'est l'exercice : penser la fuite avant qu'elle
n'arrive, pas après.

## Application TribuZen

Même revue et même correction sur `tribuzen-api/src/users/`. Commit :
`fix(users): DTO sans role (mass assignment) + réponse sans passwordHash (data exposure)`.
