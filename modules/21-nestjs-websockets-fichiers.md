# Module 21 — NestJS — WebSockets, Fichiers & Temps reel

> **Objectif** : Apprendre a gerer l'upload et le telechargement de fichiers, et a implementer une communication temps reel avec les WebSockets (Socket.io) dans NestJS.
> **Difficulte** : ⭐⭐⭐⭐ (avance+)
> **Prerequis** : Module 10 (Controllers), Module 13 (Interceptors), Module 19 (Auth JWT)
> **Duree estimee** : 6 heures

---

## 1. Upload de fichiers

### 1.1 Installation

NestJS utilise Multer (via Express) pour gerer les uploads de fichiers.

```bash
npm install @nestjs/platform-express
npm install --save-dev @types/multer
```

> **Analogie** : L'upload de fichier est comme la reception d'un colis postal. Multer est le facteur qui recoit le colis, verifie qu'il est correct (taille, type), et le depose a l'endroit que vous avez choisi (disque, memoire).

### 1.2 Upload d'un seul fichier

```typescript
// files/files.controller.ts
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';

@Controller('files')
export class FilesController {
  // Upload d'un seul fichier
  // Le champ du formulaire doit s'appeler 'file'
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    return {
      message: 'Fichier televerse avec succes',
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  // Upload avec validation integree (NestJS 9+)
  @Post('upload-validated')
  @UseInterceptors(FileInterceptor('file'))
  uploadValidatedFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5 Mo
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif|webp)$/ }),
        ],
        errorHttpStatusCode: 400,
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    return {
      message: 'Image telechargee avec succes',
      originalName: file.originalname,
      size: file.size,
    };
  }
}
```

### 1.3 Upload de plusieurs fichiers

```typescript
import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller('files')
export class FilesController {
  // Upload de plusieurs fichiers avec le meme champ
  @Post('upload-multiple')
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 fichiers
  uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    return {
      message: `${files.length} fichier(s) televerse(s)`,
      files: files.map((f) => ({
        originalName: f.originalname,
        size: f.size,
      })),
    };
  }

  // Upload de fichiers dans differents champs
  @Post('upload-fields')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'avatar', maxCount: 1 },        // Un seul avatar
      { name: 'documents', maxCount: 5 },      // Jusqu'a 5 documents
    ]),
  )
  uploadFields(
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      documents?: Express.Multer.File[];
    },
  ) {
    return {
      avatar: files.avatar?.[0]?.originalname,
      documents: files.documents?.map((f) => f.originalname),
    };
  }
}
```

### 1.4 Configuration de Multer — Stockage sur disque

```typescript
// files/multer.config.ts
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import { BadRequestException } from '@nestjs/common';

// Configuration du stockage sur disque
export const multerDiskConfig = {
  storage: diskStorage({
    // Dossier de destination
    destination: (req, file, callback) => {
      const uploadPath = join(__dirname, '..', '..', 'uploads');
      callback(null, uploadPath);
    },

    // Nom du fichier
    filename: (req, file, callback) => {
      // Generer un nom unique avec UUID
      const uniqueName = `${uuid()}${extname(file.originalname)}`;
      callback(null, uniqueName);
    },
  }),

  // Filtre de fichiers
  fileFilter: (req, file, callback) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      return callback(
        new BadRequestException(
          `Type de fichier non autorise : ${file.mimetype}. ` +
            `Types acceptes : ${allowedMimes.join(', ')}`,
        ),
        false,
      );
    }

    callback(null, true);
  },

  // Limites
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 Mo max
    files: 10,                   // 10 fichiers max par requete
  },
};
```

Utilisation de la configuration :

```typescript
import { multerDiskConfig } from './multer.config';

@Post('upload')
@UseInterceptors(FileInterceptor('file', multerDiskConfig))
uploadFile(@UploadedFile() file: Express.Multer.File) {
  return {
    url: `/uploads/${file.filename}`,
    originalName: file.originalname,
    size: file.size,
  };
}
```

### 1.5 Stockage en memoire

Utile quand vous voulez traiter le fichier (redimensionner, envoyer vers un cloud) sans l'ecrire sur le disque :

```typescript
import { memoryStorage } from 'multer';

const multerMemoryConfig = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 Mo
  },
};

@Post('upload-memory')
@UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
async uploadToCloud(@UploadedFile() file: Express.Multer.File) {
  // file.buffer contient les donnees du fichier en memoire
  // On peut les envoyer vers S3, CloudFlare R2, etc.
  const url = await this.cloudService.upload(file.buffer, file.originalname);
  return { url };
}
```

### 1.6 Telechargement de fichiers — StreamableFile

```typescript
import {
  Controller,
  Get,
  Param,
  StreamableFile,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';

@Controller('files')
export class FilesController {
  // Telecharger un fichier
  @Get('download/:filename')
  downloadFile(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const filePath = join(__dirname, '..', '..', 'uploads', filename);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Fichier introuvable');
    }

    // Definir les headers de reponse
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    // Creer un stream de lecture
    const fileStream = createReadStream(filePath);
    return new StreamableFile(fileStream);
  }

  // Servir une image (affichage inline)
  @Get('images/:filename')
  serveImage(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const filePath = join(__dirname, '..', '..', 'uploads', filename);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Image introuvable');
    }

    // Determiner le type MIME
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };

    res.set({
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=86400', // Cache 24h
    });

    const fileStream = createReadStream(filePath);
    return new StreamableFile(fileStream);
  }
}
```

### 1.7 Servir les fichiers statiques

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Servir le dossier uploads comme fichiers statiques
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/', // Accessible via http://localhost:3000/uploads/mon-image.jpg
  });

  await app.listen(3000);
}
```

> **Bonne pratique** : En production, servez les fichiers statiques via un reverse proxy (Nginx) ou un CDN, pas directement depuis NestJS. C'est beaucoup plus performant.

---

## 2. WebSockets avec Socket.io

### 2.1 Qu'est-ce qu'un WebSocket ?

HTTP est un protocole **requete-reponse** : le client demande, le serveur repond. Les WebSockets sont un protocole de communication **bidirectionnelle** et **persistante** : le serveur peut envoyer des donnees au client a tout moment, sans que le client n'ait rien demande.

> **Analogie** : HTTP c'est comme envoyer des lettres : vous ecrivez, vous postez, vous attendez la reponse. WebSocket c'est comme un appel telephonique : une fois la connexion etablie, les deux parties peuvent parler a tout moment.

| Caracteristique | HTTP | WebSocket |
|----------------|------|-----------|
| Direction | Unidirectionnelle (requete → reponse) | Bidirectionnelle |
| Connexion | Nouvelle a chaque requete | Persistante |
| Overhead | Headers a chaque requete | Minimal apres connexion |
| Cas d'usage | API REST, pages web | Chat, notifications, jeux |

### 2.2 Installation

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io
npm install socket.io
npm install --save-dev @types/socket.io
```

### 2.3 Creer un Gateway (serveur WebSocket)

```typescript
// chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsResponse,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // En production, specifiez les origines autorisees
  },
  namespace: '/chat', // Optionnel : namespace pour isoler les evenements
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server; // Reference au serveur Socket.io

  private readonly logger = new Logger('ChatGateway');

  // Compteur de connexions actives
  private connectedUsers = new Map<string, { userId: number; nom: string }>();

  // === Lifecycle Hooks ===

  // Appele apres l'initialisation du gateway
  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialise');
  }

  // Appele quand un client se connecte
  handleConnection(client: Socket) {
    this.logger.log(`Client connecte : ${client.id}`);
  }

  // Appele quand un client se deconnecte
  handleDisconnect(client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      this.connectedUsers.delete(client.id);
      // Notifier les autres que l'utilisateur est parti
      this.server.emit('userDisconnected', {
        userId: user.userId,
        nom: user.nom,
        timestamp: new Date().toISOString(),
      });
    }
    this.logger.log(`Client deconnecte : ${client.id}`);
  }

  // === Gestionnaires d'evenements ===

  // Recevoir un message de chat
  @SubscribeMessage('sendMessage')
  handleMessage(
    @MessageBody() data: { room: string; message: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;

    const payload = {
      userId: user.userId,
      nom: user.nom,
      message: data.message,
      room: data.room,
      timestamp: new Date().toISOString(),
    };

    // Envoyer le message a tous dans la room (sauf l'expediteur)
    client.to(data.room).emit('newMessage', payload);

    // Aussi envoyer a l'expediteur (confirmation)
    client.emit('newMessage', payload);
  }

  // Rejoindre une room
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: { room: string; userId: number; nom: string },
    @ConnectedSocket() client: Socket,
  ): void {
    // Enregistrer l'utilisateur
    this.connectedUsers.set(client.id, {
      userId: data.userId,
      nom: data.nom,
    });

    // Rejoindre la room Socket.io
    client.join(data.room);

    // Notifier la room
    this.server.to(data.room).emit('userJoined', {
      userId: data.userId,
      nom: data.nom,
      room: data.room,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`${data.nom} a rejoint la room ${data.room}`);
  }

  // Quitter une room
  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const user = this.connectedUsers.get(client.id);

    client.leave(data.room);

    if (user) {
      this.server.to(data.room).emit('userLeft', {
        userId: user.userId,
        nom: user.nom,
        room: data.room,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Indicateur de frappe ("... est en train d'ecrire")
  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { room: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ): void {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;

    // Emettre a tous dans la room SAUF l'expediteur
    client.to(data.room).emit('userTyping', {
      userId: user.userId,
      nom: user.nom,
      isTyping: data.isTyping,
    });
  }

  // Retourner une reponse au client (pattern requete-reponse)
  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(
    @MessageBody() data: { room: string },
  ): WsResponse<any> {
    // WsResponse retourne directement au client qui a emis
    const users = Array.from(this.connectedUsers.values());
    return {
      event: 'onlineUsers',
      data: users,
    };
  }

  // === Methodes utilitaires (appelables depuis d'autres services) ===

  // Envoyer une notification a un utilisateur specifique
  sendToUser(userId: number, event: string, data: any): void {
    for (const [socketId, user] of this.connectedUsers) {
      if (user.userId === userId) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }

  // Broadcast a tous les clients connectes
  broadcast(event: string, data: any): void {
    this.server.emit(event, data);
  }

  // Envoyer a une room specifique
  sendToRoom(room: string, event: string, data: any): void {
    this.server.to(room).emit(event, data);
  }
}
```

### 2.4 Authentification WebSocket

```typescript
// chat/chat.gateway.ts (avec authentification)
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @WebSocketServer()
  server: Server;

  // Verifier le JWT a la connexion
  async handleConnection(client: Socket) {
    try {
      // Le token peut etre dans les headers ou dans la query string
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Connexion refusee : pas de token (${client.id})`);
        client.emit('error', { message: 'Token manquant' });
        client.disconnect();
        return;
      }

      // Verifier le token
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });

      // Stocker les infos utilisateur sur le socket
      client.data.userId = payload.sub;
      client.data.email = payload.email;
      client.data.role = payload.role;

      this.logger.log(
        `Client authentifie : ${payload.email} (${client.id})`,
      );
    } catch (error) {
      this.logger.warn(`Token invalide : ${error.message} (${client.id})`);
      client.emit('error', { message: 'Token invalide' });
      client.disconnect();
    }
  }
}
```

Cote client (JavaScript/TypeScript) :

```typescript
// Code cote frontend (pour reference)
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/chat', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIs...', // Token JWT
  },
});

socket.on('connect', () => {
  console.log('Connecte au serveur WebSocket');

  // Rejoindre une room
  socket.emit('joinRoom', {
    room: 'general',
    userId: 1,
    nom: 'Alice',
  });
});

// Ecouter les messages
socket.on('newMessage', (data) => {
  console.log(`${data.nom}: ${data.message}`);
});

// Envoyer un message
socket.emit('sendMessage', {
  room: 'general',
  message: 'Bonjour tout le monde !',
});

// Indicateur de frappe
socket.emit('typing', { room: 'general', isTyping: true });
setTimeout(() => {
  socket.emit('typing', { room: 'general', isTyping: false });
}, 3000);

// Gestion des erreurs
socket.on('error', (data) => {
  console.error('Erreur WebSocket:', data.message);
});

socket.on('disconnect', () => {
  console.log('Deconnecte du serveur');
});
```

### 2.5 Le ChatModule

```typescript
// chat/chat.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [ChatGateway, ChatService],
  exports: [ChatGateway], // Exporter pour utiliser dans d'autres modules
})
export class ChatModule {}
```

### 2.6 Utiliser le Gateway depuis un autre service

```typescript
// notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class NotificationsService {
  constructor(private readonly chatGateway: ChatGateway) {}

  // Envoyer une notification en temps reel quand une commande est creee
  notifyNewOrder(userId: number, orderId: number) {
    this.chatGateway.sendToUser(userId, 'newOrder', {
      orderId,
      message: `Votre commande #${orderId} a ete recue !`,
      timestamp: new Date().toISOString(),
    });
  }

  // Notifier tous les admins
  notifyAdmins(event: string, data: any) {
    this.chatGateway.sendToRoom('admin-room', event, data);
  }

  // Broadcast a tous les utilisateurs connectes
  broadcastAnnouncement(message: string) {
    this.chatGateway.broadcast('announcement', {
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## 3. Rooms et Namespaces

### 3.1 Les Rooms

Les rooms sont des canaux virtuels dans lesquels les sockets peuvent entrer et sortir. Un message envoye a une room est recu par tous les sockets dans cette room.

```typescript
// Faire rejoindre une room
client.join('room-projet-42');

// Quitter une room
client.leave('room-projet-42');

// Envoyer a une room (tous les membres sauf l'expediteur)
client.to('room-projet-42').emit('event', data);

// Envoyer a une room (tous les membres Y COMPRIS l'expediteur)
this.server.to('room-projet-42').emit('event', data);

// Envoyer a plusieurs rooms
this.server.to('room-1').to('room-2').emit('event', data);

// Verifier les rooms d'un client
const rooms = client.rooms; // Set<string>
```

### 3.2 Les Namespaces

Les namespaces sont des canaux de communication separes avec leurs propres evenements.

```typescript
// Gateway pour le chat
@WebSocketGateway({ namespace: '/chat' })
export class ChatGateway {}

// Gateway pour les notifications (separe)
@WebSocketGateway({ namespace: '/notifications' })
export class NotificationsGateway {}

// Cote client
const chatSocket = io('http://localhost:3000/chat');
const notifSocket = io('http://localhost:3000/notifications');
```

---

## 4. Exemple complet — Application de chat

### 4.1 ChatService avec persistance des messages

```typescript
// chat/chat.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // Sauvegarder un message en base
  async saveMessage(data: {
    userId: number;
    room: string;
    message: string;
  }) {
    return this.prisma.chatMessage.create({
      data: {
        contenu: data.message,
        room: data.room,
        userId: data.userId,
      },
      include: {
        user: { select: { id: true, nom: true } },
      },
    });
  }

  // Recuperer l'historique des messages d'une room
  async getMessages(room: string, limit: number = 50, before?: Date) {
    return this.prisma.chatMessage.findMany({
      where: {
        room,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      include: {
        user: { select: { id: true, nom: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Compter les messages non lus
  async getUnreadCount(userId: number, room: string, lastRead: Date) {
    return this.prisma.chatMessage.count({
      where: {
        room,
        createdAt: { gt: lastRead },
        userId: { not: userId },
      },
    });
  }
}
```

### 4.2 Gateway avec persistance

```typescript
// Version enrichie du gateway avec sauvegarde en base
@SubscribeMessage('sendMessage')
async handleMessage(
  @MessageBody() data: { room: string; message: string },
  @ConnectedSocket() client: Socket,
): Promise<void> {
  const userId = client.data.userId;
  if (!userId) return;

  // Sauvegarder en base
  const savedMessage = await this.chatService.saveMessage({
    userId,
    room: data.room,
    message: data.message,
  });

  // Emettre a toute la room
  this.server.to(data.room).emit('newMessage', savedMessage);
}

// Recuperer l'historique au moment de rejoindre
@SubscribeMessage('joinRoom')
async handleJoinRoom(
  @MessageBody() data: { room: string },
  @ConnectedSocket() client: Socket,
): Promise<void> {
  client.join(data.room);

  // Envoyer l'historique des messages
  const history = await this.chatService.getMessages(data.room, 50);
  client.emit('messageHistory', history.reverse());

  // Notifier la room
  this.server.to(data.room).emit('userJoined', {
    userId: client.data.userId,
    email: client.data.email,
  });
}
```

---

## 5. Pipe de validation pour les fichiers

```typescript
// pipes/file-size-validation.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class FileSizeValidationPipe implements PipeTransform {
  constructor(private readonly maxSizeInMb: number = 5) {}

  transform(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Fichier requis');
    }

    const maxBytes = this.maxSizeInMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `Le fichier depasse la taille maximale de ${this.maxSizeInMb} Mo`,
      );
    }

    return file;
  }
}

// pipes/file-type-validation.pipe.ts
@Injectable()
export class FileTypeValidationPipe implements PipeTransform {
  constructor(private readonly allowedTypes: string[]) {}

  transform(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Fichier requis');
    }

    if (!this.allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Type ${file.mimetype} non autorise. Acceptes : ${this.allowedTypes.join(', ')}`,
      );
    }

    return file;
  }
}
```

---

## 6. Exercices pratiques

### Exercice 1 : Upload d'images de produits

Implementez un endpoint `POST /products/:id/images` qui :
1. Accepte jusqu'a 5 images (jpeg, png, webp)
2. Limite la taille a 2 Mo par image
3. Sauvegarde sur le disque avec des noms uniques (UUID)
4. Enregistre les chemins en base de donnees
5. Retourne les URLs des images

### Exercice 2 : Application de chat

Implementez une application de chat complete avec :
1. Authentification JWT a la connexion WebSocket
2. Systeme de rooms
3. Persistance des messages en base
4. Indicateur de frappe
5. Liste des utilisateurs connectes par room

### Exercice 3 : Notifications en temps reel

Creez un systeme de notifications temps reel qui envoie un evenement WebSocket quand :
1. Un nouvel article est publie
2. Un commentaire est ajoute a un article de l'utilisateur
3. Un utilisateur recoit un nouveau role

---

## Liens

| Ressource | Lien |
|-----------|------|
| Quiz Module 21 | `quiz/21-quiz.md` |
| Lab Module 21 | `labs/21-lab-websockets-fichiers.md` |
| Screencast | `screencasts/21-screencast.md` |
| Module precedent | [Module 20 — Configuration & Swagger](20-nestjs-config-swagger.md) |
| Module suivant | [Module 22 — Taches planifiees & Files d'attente](22-nestjs-jobs-queues.md) |
| NestJS File Upload | https://docs.nestjs.com/techniques/file-upload |
| NestJS WebSockets | https://docs.nestjs.com/websockets/gateways |
| Socket.io | https://socket.io/docs/v4/ |
| Multer | https://github.com/expressjs/multer |
