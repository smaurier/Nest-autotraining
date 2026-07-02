---
titre: NestJS WebSockets et fichiers
cours: 09-nestjs
notions: [WebSocketGateway, cycle de vie de la gateway, SubscribeMessage et événements, rooms et broadcast, gestion de la connexion, upload de fichiers avec Multer, FileInterceptor, validation et stockage des fichiers, streaming de fichiers]
outcomes: [créer une gateway WebSocket qui émet et reçoit des événements, diffuser dans une room, gérer l'upload d'un fichier avec FileInterceptor, valider et servir des fichiers]
prerequis: [20-nestjs-config-swagger]
next: 22-nestjs-jobs-queues
libs: [{ name: "@nestjs/websockets", version: "^11" }, { name: "socket.io", version: "^4" }]
tribuzen: notifications temps réel du feed TribuZen (nouveau post) et upload des médias famille
last-reviewed: 2026-07
---

# NestJS WebSockets et fichiers

> **Outcomes — tu sauras FAIRE :** créer une gateway WebSocket qui émet et reçoit des événements, diffuser dans une room, gérer l'upload d'un fichier avec `FileInterceptor`, valider et servir des fichiers.
> **Difficulté :** :star::star::star::star:

## 1. Cas concret d'abord

TribuZen doit notifier en temps réel tous les membres d'une famille lorsqu'un nouveau post apparaît dans leur feed. Tu essaies de le faire avec HTTP polling :

```ts
// ❌ tentative naïve — polling HTTP toutes les 5 s
setInterval(() => {
  fetch('/api/families/fam-1/feed/latest').then(r => r.json()).then(updateUI)
}, 5000)
```

Cinq secondes de latence minimum, des centaines de requêtes inutiles, une infrastructure qui ne passe pas à l'échelle. TribuZen a aussi besoin d'uploader des photos de famille (avatars, souvenirs). Stocker le fichier dans le body JSON (base64) double la taille de la requête et casse les CDN.

WebSockets + Multer résolvent les deux problèmes dans NestJS :

```ts
// ✅ push immédiat — le serveur notifie les clients connectés
this.server.to(`family-${familyId}`).emit('new-post', { postId, authorId, createdAt })

// ✅ upload propre — Multer parse le multipart/form-data
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
uploadMedia(@UploadedFile() file: Express.Multer.File) { ... }
```

Ce module couvre le mécanisme complet : gateway WebSocket, cycle de vie, rooms, événements, upload Multer, validation et streaming de fichiers.

## 2. Théorie complète, concise

### 2.1 `@WebSocketGateway()` et le cycle de vie

Une **gateway** est une classe décorée `@WebSocketGateway()` qui écoute les connexions Socket.IO. NestJS la traite comme un provider : elle doit être déclarée dans `providers` d'un `@Module()`.

```ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

@WebSocketGateway({
  cors: { origin: '*' }, // en production restreindre aux origines connues
  namespace: '/feed',    // optionnel — isole les événements du feed
})
export class FeedGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server // instance Socket.IO injectée par NestJS après afterInit

  afterInit(server: Server) {
    console.log('FeedGateway initialisée')
  }

  handleConnection(client: Socket) {
    console.log(`Connecté : ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    console.log(`Déconnecté : ${client.id}`)
  }
}
```

Les trois interfaces du cycle de vie :

| Interface | Méthode | Moment d'appel |
|-----------|---------|---------------|
| `OnGatewayInit` | `afterInit(server)` | Après démarrage du serveur Socket.IO |
| `OnGatewayConnection` | `handleConnection(client)` | Connexion d'un socket client |
| `OnGatewayDisconnect` | `handleDisconnect(client)` | Déconnexion d'un socket client |

NestJS injecte le `Server` Socket.IO dans la propriété annotée `@WebSocketServer()`. Ce décorateur est obligatoire pour émettre depuis la gateway.

### 2.2 `@SubscribeMessage` et événements

`@SubscribeMessage('event')` écoute un événement entrant. `@MessageBody()` extrait le payload ; `@ConnectedSocket()` donne accès au socket émetteur.

```ts
import {
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsResponse,
} from '@nestjs/websockets'
import { Socket } from 'socket.io'

// Retour void — diffusion asynchrone via server.to(...).emit(...)
@SubscribeMessage('join-family')
handleJoinFamily(
  @MessageBody() data: { familyId: string },
  @ConnectedSocket() client: Socket,
): void {
  client.join(`family-${data.familyId}`)
  this.server.to(`family-${data.familyId}`).emit('member-joined', { socketId: client.id })
}

// Retour WsResponse<T> — acknowledgement synchrone vers l'émetteur uniquement
@SubscribeMessage('ping')
handlePing(): WsResponse<string> {
  return { event: 'pong', data: 'pong' }
}
```

Deux modes de réponse :

| Mode | Quand l'utiliser |
|------|-----------------|
| `void` + `server.emit(...)` | Diffuser à plusieurs sockets (room, broadcast) |
| `WsResponse<T>` | Réponse directe au client émetteur (acknowledgement) |

### 2.3 Rooms et broadcast

Les **rooms** sont des canaux virtuels gérés par Socket.IO. Un socket peut rejoindre et quitter des rooms à tout moment. Les messages envoyés à une room ne sont reçus que par les sockets inscrits.

```ts
// Rejoindre une room
client.join('family-fam-1')

// Quitter une room
client.leave('family-fam-1')

// Émettre vers une room — EXCLUT l'émetteur
client.to('family-fam-1').emit('new-post', payload)

// Émettre vers une room — INCLUT l'émetteur
this.server.to('family-fam-1').emit('new-post', payload)

// Émettre vers plusieurs rooms
this.server.to('family-fam-1').to('family-fam-2').emit('announcement', payload)

// Broadcast global — tous les sockets connectés
this.server.emit('system-notice', { message: 'Maintenance dans 5 min' })
```

Différence clé :

| Appel | Inclut l'émetteur | Accès requis |
|-------|------------------|--------------|
| `client.to(room).emit(...)` | Non | `@ConnectedSocket()` dans le handler |
| `this.server.to(room).emit(...)` | Oui | `@WebSocketServer()` |

### 2.4 Gestion de la connexion

Le handshake HTTP initial est le moment privilégié pour valider le client. `client.handshake` expose `auth`, `headers`, `query` et `address`. Les données persistantes de session se stockent sur `client.data`.

```ts
handleConnection(client: Socket) {
  const token =
    client.handshake.auth?.token ??
    client.handshake.headers?.authorization?.replace('Bearer ', '')

  if (!token) {
    client.disconnect() // refus immédiat
    return
  }

  // Stocker les infos utilisateur sur le socket — persistant pendant la connexion
  client.data.userId = 'usr-42'
  client.data.familyId = 'fam-1'
}
```

Le côté client envoie le token via `io(url, { auth: { token: 'eyJ...' } })`.

### 2.5 Upload de fichiers avec `FileInterceptor`

NestJS délègue l'upload à **Multer** (inclus dans `@nestjs/platform-express`). `FileInterceptor(fieldName, options)` parse le `multipart/form-data` et expose le fichier via `@UploadedFile()`.

```ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname } from 'path'

@Controller('media')
export class MediaController {
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          // Nom unique côté serveur — ne jamais utiliser file.originalname directement
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
          cb(null, `${unique}${extname(file.originalname)}`)
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
    }),
  )
  uploadMedia(@UploadedFile() file: Express.Multer.File) {
    return { url: `/uploads/${file.filename}`, originalName: file.originalname }
  }
}
```

`FileInterceptor` prend deux arguments :
1. `fieldName` — nom du champ HTML `<input type="file" name="file">`
2. `options` — objet `MulterOptions` optionnel : `storage`, `fileFilter`, `limits`

Sans `storage` explicite, Multer utilise `memoryStorage()` : `file.filename` est `undefined`, seul `file.buffer` est disponible.

### 2.6 Validation et stockage

NestJS fournit `ParseFilePipe` avec des validateurs intégrés, applicables directement dans `@UploadedFile()`.

```ts
import {
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common'

@Post('upload')
@UseInterceptors(FileInterceptor('file'))
uploadMedia(
  @UploadedFile(
    new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5 Mo
        new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)/ }),
      ],
      fileIsRequired: true,
    }),
  )
  file: Express.Multer.File,
) {
  return { filename: file.filename, size: file.size }
}
```

Validateurs intégrés :

| Validateur | Paramètre | Comportement |
|------------|-----------|-------------|
| `MaxFileSizeValidator` | `maxSize` (octets) | Lève 400 si le fichier dépasse la taille |
| `FileTypeValidator` | `fileType` (string ou RegExp) | Lève 400 si le MIME ne correspond pas |

`ParseFilePipe` lève automatiquement une `BadRequestException` (400) en cas d'échec, avant que le handler soit invoqué.

Stockage en mémoire pour transfert cloud :

```ts
import { memoryStorage } from 'multer'

@Post('upload-memory')
@UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
async uploadToCloud(@UploadedFile() file: Express.Multer.File) {
  // file.buffer disponible — pas d'écriture disque
  const url = await this.storageService.upload(file.buffer, file.originalname)
  return { url }
}
```

### 2.7 Streaming de fichiers avec `StreamableFile`

Pour servir un fichier téléchargeable sans le charger entièrement en mémoire, utiliser `StreamableFile` + `createReadStream`.

```ts
import { Get, Param, StreamableFile, Res, NotFoundException } from '@nestjs/common'
import { Response } from 'express'
import { createReadStream, existsSync } from 'fs'
import { join } from 'path'

@Get('download/:filename')
downloadFile(
  @Param('filename') filename: string,
  @Res({ passthrough: true }) res: Response,
): StreamableFile {
  const filePath = join(process.cwd(), 'uploads', filename)
  if (!existsSync(filePath)) throw new NotFoundException('Fichier introuvable')

  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${filename}"`,
  })
  return new StreamableFile(createReadStream(filePath))
}
```

`@Res({ passthrough: true })` permet de modifier les headers HTTP tout en laissant NestJS gérer la réponse. Sans `passthrough: true`, NestJS cède le contrôle total à Express : `ExceptionFilter`, `Interceptor` et la réponse automatique NestJS sont désactivés.

## 3. Worked examples

### Exemple A — FeedGateway TribuZen

Gateway complète : rejoindre la room famille, émettre un nouveau post, gérer la déconnexion.

```ts
// src/feed/feed.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { Server, Socket } from 'socket.io'

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/feed' })
export class FeedGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(FeedGateway.name)

  handleConnection(client: Socket) {
    this.logger.log(`Connecté : ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Déconnecté : ${client.id}`)
  }

  // Le client rejoint la room de sa famille
  @SubscribeMessage('join-family')
  handleJoinFamily(
    @MessageBody() data: { familyId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const room = `family-${data.familyId}`
    client.join(room) // inscrit le socket à la room — persiste pendant la connexion
    client.data.userId = data.userId
    client.data.familyId = data.familyId

    // Confirmer uniquement à l'émetteur — client.emit, pas server.to(room)
    client.emit('joined', { room, userId: data.userId })
    this.logger.log(`${data.userId} a rejoint ${room}`)
  }

  // Méthode publique — PostsService l'appelle après création d'un post
  notifyNewPost(familyId: string, postId: string, authorId: string): void {
    // server.to() inclut tous les sockets de la room, y compris l'auteur
    this.server.to(`family-${familyId}`).emit('new-post', {
      postId,
      authorId,
      createdAt: new Date().toISOString(),
    })
  }
}
```

```ts
// src/feed/feed.module.ts
import { Module } from '@nestjs/common'
import { FeedGateway } from './feed.gateway'

@Module({
  providers: [FeedGateway],
  exports: [FeedGateway], // PostsService peut injecter FeedGateway
})
export class FeedModule {}
```

```ts
// src/posts/posts.service.ts
import { Injectable } from '@nestjs/common'
import { FeedGateway } from '../feed/feed.gateway'

@Injectable()
export class PostsService {
  constructor(
    // FeedGateway injectable car FeedModule est importé dans PostsModule
    private readonly feedGateway: FeedGateway,
  ) {}

  createPost(familyId: string, authorId: string, content: string) {
    const postId = `post-${Date.now()}`
    // ... persistance en base (Prisma au module 14) ...

    // Notifier en temps réel tous les membres connectés de la famille
    this.feedGateway.notifyNewPost(familyId, postId, authorId)
    return { postId, familyId, authorId, content }
  }
}
```

**Pas-à-pas :** (1) `@WebSocketGateway({ namespace: '/feed' })` isole les événements TribuZen — un client se connecte à `http://localhost:3000/feed` ; (2) `handleConnection` et `handleDisconnect` tracent les connexions sans logique métier — l'authentification s'y ajoute en 2.4 ; (3) `client.join(room)` inscrit le socket à `family-fam-1` — tous les sockets de cette room recevront les émissions ciblées ; (4) `notifyNewPost` est une méthode publique injectable via DI depuis `PostsService` ; (5) `exports: [FeedGateway]` dans `FeedModule` + `imports: [FeedModule]` dans `PostsModule` — même règle que pour les services (module 11).

### Exemple B — MediaController avec upload et streaming

```ts
// src/media/media.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  StreamableFile,
  Res,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { createReadStream, existsSync } from 'fs'
import { Response } from 'express'

const UPLOAD_DIR = join(process.cwd(), 'uploads')
const MAX_SIZE = 5 * 1024 * 1024 // 5 Mo

@Controller('media')
export class MediaController {
  // Upload avec validation intégrée — ParseFilePipe lève 400 si invalide
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          // Nom généré côté serveur — jamais file.originalname (path traversal)
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
          cb(null, `${unique}${extname(file.originalname)}`)
        },
      }),
    }),
  )
  uploadMedia(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_SIZE }),
          new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)/ }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    // Retourner l'URL publique — le chemin disque n'est jamais exposé
    return {
      url: `/uploads/${file.filename}`,
      originalName: file.originalname,
      size: file.size,
    }
  }

  // Streaming — pas de chargement mémoire complet
  @Get(':filename')
  serveMedia(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const filePath = join(UPLOAD_DIR, filename)
    if (!existsSync(filePath)) throw new NotFoundException('Média introuvable')

    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    const mime: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', webp: 'image/webp',
    }

    res.set({
      'Content-Type': mime[ext] ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=86400',
    })
    return new StreamableFile(createReadStream(filePath))
  }
}
```

**Pas-à-pas :** (1) `FileInterceptor('file', { storage: diskStorage(...) })` parse le champ `file` du `multipart/form-data` et écrit sur le disque avec un nom unique — sans `storage`, Multer stocke en `memoryStorage` et `file.filename` est `undefined` ; (2) `ParseFilePipe` regroupe les validators dans `@UploadedFile()` — NestJS lève automatiquement 400 avant que le handler soit invoqué ; (3) `extname(file.originalname)` conserve `.jpg`, `.png`, etc. — jamais utiliser `file.originalname` directement comme nom de fichier (injection de chemin) ; (4) `StreamableFile(createReadStream(...))` streame le fichier sans le charger entièrement en mémoire — crucial pour les vidéos et archives ; (5) `@Res({ passthrough: true })` laisse NestJS gérer la réponse tout en permettant de définir les headers.

## 4. Pièges & misconceptions

- **Gateway non déclarée dans `providers`.** `@WebSocketGateway()` seul ne suffit pas. Si la gateway n'est pas dans `providers: [FeedGateway]` du module, NestJS ne l'instancie pas et Socket.IO n'écoute aucune connexion. Correction : déclarer la gateway dans `providers` comme tout autre provider.

- **`this.server` accédé dans le constructeur.** `@WebSocketServer()` injecte l'instance après `afterInit()` — dans le constructeur, `this.server` est `undefined`. Utiliser `this.server` dans le constructeur provoque une erreur silencieuse ou un `TypeError: Cannot read properties of undefined`. Correction : n'accéder à `this.server` que dans les handlers et méthodes publiques appelées après démarrage.

- **`client.to(room)` vs `this.server.to(room)` confondus.** `client.to(room).emit(...)` exclut l'émetteur ; `this.server.to(room).emit(...)` l'inclut. Pour diffuser "quelqu'un a rejoint" à tous les membres y compris l'arrivant → `this.server.to(room)`. Pour notifier la room de l'arrivée d'un autre → `client.to(room)`. Les confondre provoque des doublons ou des silences côté client.

- **`FileInterceptor` sans `storage` = mémoire, `file.filename` undefined.** Sans option `storage`, Multer utilise `memoryStorage()`. `file.filename` est `undefined` — le handler qui tente `return { url: /uploads/${file.filename} }` retourne `url: '/uploads/undefined'`. Correction : toujours expliciter `{ storage: diskStorage(...) }` quand un nom de fichier est nécessaire.

- **`@Res()` sans `passthrough: true` désactive les pipes NestJS.** Injecter `@Res()` seul donne le contrôle total à Express : `ExceptionFilter`, `Interceptor` et la réponse automatique NestJS sont désactivés — `NotFoundException` ne produit plus de 404, elle passe en silence. Correction : `@Res({ passthrough: true })` systématiquement quand on ne veut que modifier les headers.

- **`file.originalname` utilisé comme nom de fichier disque.** Un client peut envoyer `../../etc/passwd` comme nom — path traversal. Correction : générer un nom unique côté serveur (`Date.now()` + random + `extname(file.originalname)`) et ne jamais faire confiance à `file.originalname` pour le stockage.

## 5. Ancrage TribuZen

Couche fil-rouge : **notifications temps réel du feed TribuZen (nouveau post) et upload des médias famille** (`smaurier/tribuzen`).

- `FeedGateway` avec namespace `/feed` — chaque famille a sa room `family-{id}`. Quand un membre crée un post, `PostsService` appelle `feedGateway.notifyNewPost(familyId, postId, authorId)` et tous les sockets connectés à cette room reçoivent `new-post` immédiatement — zéro polling.
- `handleConnection` vérifie le token JWT dans `client.handshake.auth.token` (module 19 auth) — un socket non authentifié est déconnecté avant de rejoindre une room.
- `MediaController` gère l'upload des photos famille (souvenirs, avatars groupe) — `diskStorage` avec nom unique, `ParseFilePipe` avec `MaxFileSizeValidator` (5 Mo) et `FileTypeValidator` (jpeg/png/webp), streaming avec `StreamableFile` pour le téléchargement.
- `FeedGateway` exportée depuis `FeedModule` et injectée dans `PostsService` — même pattern DI que les services classiques (module 11).

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  feed/
    feed.gateway.ts       ← FeedGateway — WebSocket, rooms family-{id}
    feed.module.ts        ← providers + exports FeedGateway
  posts/
    posts.service.ts      ← injecte FeedGateway, appelle notifyNewPost
    posts.controller.ts   ← POST /posts → PostsService
    posts.module.ts       ← imports FeedModule
  media/
    media.controller.ts   ← POST /media/upload + GET /media/:filename
    media.module.ts
uploads/                  ← fichiers locaux (CDN en production)
```

## 6. Points clés

1. `@WebSocketGateway()` crée un serveur Socket.IO — déclaration dans `providers` obligatoire, comme tout provider.
2. `@WebSocketServer()` injecte `Server` après `afterInit()` — jamais `undefined` hors du constructeur.
3. `OnGatewayInit` / `OnGatewayConnection` / `OnGatewayDisconnect` — trois interfaces de cycle de vie pour brancher initialisation, authentification et nettoyage.
4. `@SubscribeMessage('event')` + `@MessageBody()` + `@ConnectedSocket()` — triplet standard pour un handler d'événement entrant.
5. `client.to(room).emit(...)` exclut l'émetteur ; `this.server.to(room).emit(...)` l'inclut — choisir selon le besoin de diffusion.
6. `FileInterceptor('field', options)` dans `@UseInterceptors()` — `storage: diskStorage(...)` pour écriture disque, `memoryStorage()` (défaut implicite) pour buffer mémoire.
7. `ParseFilePipe` dans `@UploadedFile(...)` regroupe `MaxFileSizeValidator` et `FileTypeValidator` — NestJS lève 400 avant le handler si la validation échoue.
8. `StreamableFile(createReadStream(...))` + `@Res({ passthrough: true })` — stream sans chargement mémoire complet, headers HTTP personnalisables.

## 7. Seeds Anki

```
Pourquoi @WebSocketGateway() doit-il être déclaré dans providers d'un @Module() ?|La décoration seule ne suffit pas — NestJS n'instancie et n'enregistre la gateway dans Socket.IO que si elle figure dans providers. Sans cette déclaration, aucun événement n'est écouté
Quand this.server (@WebSocketServer()) est-il disponible dans une gateway ?|Après l'appel à afterInit() — dans le constructeur, this.server est undefined car NestJS l'injecte pendant l'initialisation Socket.IO
Différence entre client.to(room).emit() et this.server.to(room).emit() ?|client.to(room) exclut le socket émetteur de la diffusion ; this.server.to(room) inclut tous les membres de la room y compris l'émetteur
Que se passe-t-il si FileInterceptor est utilisé sans storage explicite ?|Multer utilise memoryStorage par défaut — file.filename est undefined et seul file.buffer contient les données du fichier
Quels sont les deux validateurs intégrés de ParseFilePipe et que font-ils ?|MaxFileSizeValidator vérifie la taille en octets et FileTypeValidator vérifie le MIME type — tous deux lèvent BadRequestException (400) avant que le handler soit invoqué
Pourquoi faut-il @Res({ passthrough: true }) et non @Res() seul avec StreamableFile ?|Sans passthrough: true NestJS cède le contrôle total à Express — ExceptionFilter et Interceptors sont désactivés et les exceptions NestJS ne produisent plus les réponses HTTP attendues
Comment éviter la path traversal lors de la génération du nom de fichier Multer ?|Générer un nom unique côté serveur (Date.now() + random + extname) — ne jamais utiliser file.originalname directement comme nom de fichier disque
Comment PostsService peut-il injecter FeedGateway pour émettre des événements WebSocket ?|Exporter FeedGateway depuis FeedModule (exports) et importer FeedModule dans PostsModule (imports) — même mécanique DI que pour tout autre provider NestJS
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-21-websockets/README.md`. Tu y implémentes `FeedGateway` avec rooms et `notifyNewPost`, et `MediaController` avec upload Multer validé et streaming — corrigé complet commenté + variante J+30 dans le README.

---

← [Module 20 — Configuration et Swagger](20-nestjs-config-swagger.md) | [Module 22 — Jobs et queues](22-nestjs-jobs-queues.md) →
