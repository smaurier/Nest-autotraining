# Lab 21 — NestJS WebSockets et fichiers

> **Outcome :** à la fin, tu sais créer une `FeedGateway` WebSocket avec rooms Socket.IO, émettre vers une room famille, et gérer l'upload/download de médias avec `FileInterceptor` + `ParseFilePipe` — en **NestJS 11 réel**.
> **Vrai outil :** NestJS 11 (`@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `multer`).
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu construis deux fonctionnalités de TribuZen dans un projet NestJS 11 existant (`nest new tribuzen-realtime`). Pas de gap-fill — tu écris tout de A à Z.

**Objectif fonctionnel :**

- `FeedGateway` sur namespace `/feed` : les clients rejoignent la room `family-{familyId}` et reçoivent l'événement `new-post` quand un post est créé
- `MediaController` : `POST /media/upload` accepte une image (jpeg/png/webp, ≤ 5 Mo), la stocke sur disque avec un nom unique, et retourne l'URL ; `GET /media/:filename` streame le fichier avec les bons headers

## Étapes (en friction)

1. **Installer les dépendances.** Ajoute `@nestjs/websockets @nestjs/platform-socket.io socket.io` et `@types/multer` en dev. Vérifie que `@nestjs/platform-express` est présent (inclus par défaut dans un projet NestJS 11).

2. **Créer `FeedGateway`.** Crée `src/feed/feed.gateway.ts` avec `@WebSocketGateway({ namespace: '/feed', cors: { origin: '*' } })`. Implémenter les trois interfaces de cycle de vie (`OnGatewayInit`, `OnGatewayConnection`, `OnGatewayDisconnect`). Ajouter `@SubscribeMessage('join-family')` qui fait rejoindre la room `family-{familyId}` au client et confirme avec `client.emit('joined', { room })`. Déclarer dans `FeedModule`.

3. **Méthode `notifyNewPost`.** Ajouter `notifyNewPost(familyId, postId, authorId)` sur `FeedGateway` qui émet `new-post` vers `this.server.to(`family-${familyId}`)`. Créer `PostsService` qui injecte `FeedGateway` et expose `createPost(familyId, authorId, content)`. Exporter `FeedGateway` depuis `FeedModule` et importer `FeedModule` dans `PostsModule`.

4. **Créer `MediaController`.** Implémenter `POST /media/upload` avec `FileInterceptor('file', { storage: diskStorage(...) })` et `ParseFilePipe` (`MaxFileSizeValidator` 5 Mo + `FileTypeValidator` jpeg/png/webp). Générer le nom de fichier avec `Date.now() + random + extname`. Retourner `{ url, originalName, size }`.

5. **Implémenter le streaming.** Ajouter `GET /media/:filename` qui vérifie l'existence du fichier, pose les headers `Content-Type` et `Content-Disposition`, et retourne `new StreamableFile(createReadStream(filePath))`. Utiliser `@Res({ passthrough: true })`.

6. **Vérification.** Démarrer avec `nest start`. Tester le WebSocket avec le snippet client ci-dessous. Tester l'upload avec `curl -F "file=@photo.jpg" http://localhost:3000/media/upload` et le download avec `curl http://localhost:3000/media/<filename> -o out.jpg`.

## Corrigé complet commenté

```ts
// src/feed/feed.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { Server, Socket } from 'socket.io'

@WebSocketGateway({ namespace: '/feed', cors: { origin: '*' } })
export class FeedGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server // injecté par NestJS après afterInit — undefined dans le constructeur

  private readonly logger = new Logger(FeedGateway.name)

  afterInit() {
    this.logger.log('FeedGateway prête') // server disponible ici
  }

  handleConnection(client: Socket) {
    this.logger.log(`Connecté : ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Déconnecté : ${client.id}`)
  }

  @SubscribeMessage('join-family')
  handleJoinFamily(
    @MessageBody() data: { familyId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const room = `family-${data.familyId}`
    client.join(room) // inscrit le socket — persiste pendant la connexion
    client.data.userId = data.userId
    client.data.familyId = data.familyId

    // Confirmer uniquement à l'émetteur (client.emit, pas server.to)
    client.emit('joined', { room, userId: data.userId })
    this.logger.log(`${data.userId} a rejoint ${room}`)
  }

  // Méthode publique — injectable depuis PostsService via DI
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
  exports: [FeedGateway], // PostsModule peut injecter FeedGateway
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
    // Persistance en base ici (Prisma au module 14) — omis pour se concentrer sur le sujet

    // Notifier en temps réel tous les membres connectés de la famille
    this.feedGateway.notifyNewPost(familyId, postId, authorId)
    return { postId, familyId, authorId, content }
  }
}
```

```ts
// src/posts/posts.module.ts
import { Module } from '@nestjs/common'
import { FeedModule } from '../feed/feed.module'
import { PostsService } from './posts.service'

@Module({
  imports: [FeedModule], // rend FeedGateway injectable dans ce module
  providers: [PostsService],
})
export class PostsModule {}
```

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
const MAX_SIZE_BYTES = 5 * 1024 * 1024

@Controller('media')
export class MediaController {
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
          new MaxFileSizeValidator({ maxSize: MAX_SIZE_BYTES }),
          // RegExp sur le MIME — vérifie jpeg, png, webp
          new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)/ }),
        ],
        fileIsRequired: true,
        // ParseFilePipe lève BadRequestException (400) si un validator échoue
      }),
    )
    file: Express.Multer.File,
  ) {
    return {
      url: `/uploads/${file.filename}`,
      originalName: file.originalname,
      size: file.size,
    }
  }

  @Get(':filename')
  serveMedia(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response, // passthrough: true — NestJS garde le contrôle
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
    // createReadStream — stream sans chargement mémoire complet
    return new StreamableFile(createReadStream(filePath))
  }
}
```

Snippet client socket.io pour tester manuellement :

```ts
// test-client.mjs — exécuter séparément avec node test-client.mjs
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000/feed')

socket.on('connect', () => {
  console.log('Connecté :', socket.id)
  socket.emit('join-family', { familyId: 'fam-1', userId: 'usr-42' })
})

socket.on('joined', (data) => console.log('Rejoint :', data))
socket.on('new-post', (data) => console.log('Nouveau post :', data))
```

Points de validation par le coach : (a) `FeedGateway` déclarée dans `providers` **et** dans `exports` de `FeedModule` ; (b) `this.server` jamais utilisé dans le constructeur ; (c) `diskStorage` avec nom unique côté serveur — pas `file.originalname` ; (d) `ParseFilePipe` avec les deux validateurs dans `@UploadedFile()` — avant le handler ; (e) `@Res({ passthrough: true })` et non `@Res()` seul sur le endpoint de streaming.

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 25 minutes**, et ajoute :

1. Dans `handleConnection`, extraire le token depuis `client.handshake.auth.token`. Si absent, appeler `client.disconnect()`. Tester qu'un client sans token ne peut pas rejoindre une room.

2. Ajouter `@SubscribeMessage('leave-family')` qui fait quitter la room et émet `left` vers la room entière via `this.server.to(room).emit()`. Justifier à voix haute pourquoi on utilise `this.server.to(room)` et non `client.to(room)` ici.

3. Remplacer le `diskStorage` par `memoryStorage()` dans `MediaController`. Observer que `file.filename` est `undefined`. Que contient `file.buffer` ? Revenir ensuite à `diskStorage` et expliquer quand préférer l'un ou l'autre.

Temps cible : 25 minutes sans le corrigé.

## Application TribuZen

Commit cible dans `smaurier/tribuzen` :

```
feat(feed): FeedGateway rooms + MediaController upload/stream
```

Fichiers à créer :

- `apps/api/src/feed/feed.gateway.ts`
- `apps/api/src/feed/feed.module.ts`
- `apps/api/src/posts/posts.service.ts`
- `apps/api/src/posts/posts.module.ts`
- `apps/api/src/media/media.controller.ts`
- `apps/api/src/media/media.module.ts`

Critère de done : `POST /media/upload` avec une image PNG ≤ 5 Mo répond 201 avec l'URL, `GET /media/<filename>` streame l'image avec `Content-Type: image/png`, et un client socket.io connecté à `/feed` reçoit `new-post` quand `PostsService.createPost(...)` est appelé.
