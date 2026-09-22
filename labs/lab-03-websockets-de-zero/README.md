# Lab 03 — Un WebSocket Gateway temps réel, de zéro

> **Outcome :** à la fin, tu as construit `NotificationsGateway` — des clients rejoignent la
> "room" d'une famille et reçoivent en temps réel les posts créés dans cette famille, et
> **seulement** cette famille. Testé à deux niveaux : unitaire (le Gateway instancié
> directement, sans réseau) et e2e (un vrai serveur socket.io, de vrais clients qui se
> connectent par le réseau local).
> **Vrai outil :** `@nestjs/websockets` + `@nestjs/platform-socket.io` **11.0.1**, `socket.io` 4.8,
> `socket.io-client` pour l'e2e. Jest 30.
> **Feedback :** `npm run lab:03` — unitaire puis e2e. `npm run solution:03` prouve l'oracle.

## Lire avant (une lecture bornée)

- Module [`21-nestjs-websockets-fichiers.md`](../../modules/21-nestjs-websockets-fichiers.md) §2
  jusqu'à la section sur les rooms — `@WebSocketGateway`, `@SubscribeMessage`, `client.join`,
  `server.to(room).emit`.
- Module [`13-nestjs-pipes-guards-interceptors.md`](../../modules/13-nestjs-pipes-guards-interceptors.md) — `WsException`, l'équivalent WebSocket d'une exception HTTP.

## Énoncé

Tu écris `src/notifications/notifications.gateway.ts` et `notifications.module.ts` en entier.
Deux messages à gérer :

- `"join"` — le client envoie un `familyId` (string) ; le Gateway le fait rejoindre la room
  correspondante. Rien d'autre.
- `"post:create"` — le client envoie `{ familyId, content }`. Si `content` est vide/blanc →
  `WsException("content requis")`. Sinon, le Gateway **diffuse** un event `"post:created"`
  (`{ id, familyId, content, createdAt }`) à **toute** la room — y compris l'émetteur : c'est
  le flux temps réel qui sert de confirmation, pas un accusé de réception séparé.

Le point pédagogique central : **les rooms isolent réellement**. Un client de la famille A ne
reçoit jamais rien de la famille B, même si les deux Gateways tournent sur le même process.

## Étapes (en friction)

1. `notifications.module.ts` d'abord (trivial, mais rien ne démarre sans lui).
2. `handleJoin` — une ligne.
3. `handlePostCreate` — la validation d'abord (`WsException`), puis la construction du post,
   puis la diffusion via `this.server.to(familyId).emit(...)`.
4. `npm run lab:03` — la couche unitaire (rapide, sans réseau) te dit si la forme est bonne
   avant que la couche e2e (plus lente, un vrai serveur) ne le confirme en conditions réelles.

## Vérifier

```bash
cd 09-nestjs/labs
npm install
npm run lab:03
npm run check:03
```

**Ce que l'oracle vérifie**

Unitaire (3 cas, Gateway instancié directement, `server`/`client` mockés) : `join` appelle
`client.join` avec la bonne room ; `post:create` diffuse avec les bons champs (`id`, `createdAt`
générés) ; un `content` vide lève `WsException` **sans** diffuser. E2E (4 cas, vrai serveur +
vrais clients `socket.io-client`) : un client reçoit son propre post ; deux clients dans la même
room reçoivent tous les deux le même post ; un client d'une **autre** famille ne reçoit **rien**
(isolation réelle des rooms, pas supposée) ; un `content` vide déclenche un event `"exception"`
côté client, jamais de `"post:created"`.

## Variante J+30 (fading)

Ajoute un message `"leave"` (le client quitte une room) et un event `"member:left"` diffusé aux
autres membres de la room quand quelqu'un la quitte. Écris le test e2e (deux clients, l'un quitte,
l'autre doit recevoir l'event, celui qui est parti non) avant d'implémenter.

## Application TribuZen

`tribuzen-api/src/notifications/notifications.gateway.ts`, branché sur le front React
(`FamilyFeed` s'abonne à la room de sa famille au montage). Commit :
`feat(notifications): Gateway temps réel — rooms par famille, tests unit+e2e`.
