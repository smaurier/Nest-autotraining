# Screencast 21 — WebSockets & Fichiers

## Informations
- **Duree estimee** : 18-22 min
- **Module** : `modules/21-nestjs-websockets-fichiers.md`
- **Lab associe** : `labs/lab-21-websockets/`
- **Prérequis** : Screencast 20 (Config & Swagger)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Projet NestJS fonctionnel
- [ ] Editeur de code ouvert
- [ ] Navigateur avec console DevTools
- [ ] Port 3000 disponible

## Script

### [00:00-03:00] Introduction — Au-dela de REST

> Salut ! Jusqu'ici, toutes nos interactions sont en requête-réponse : le client envoie, le serveur repond, c'est fini. Mais certaines fonctionnalites necessitent une communication en temps réel : un chat, des notifications, un dashboard live. C'est la que les WebSockets entrent en jeu.

**Action** : Afficher le slide de titre "Module 21 — WebSockets & Fichiers".

> Les WebSockets ouvrent une connexion permanente entre le client et le serveur. Les deux peuvent s'envoyer des messages a tout moment, sans attendre une requête. On va construire un chat en temps réel avec NestJS et Socket.IO.

**Action** : Installer les dépendances.

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

### [03:00-08:00] Gateway WebSocket — Le serveur temps réel

**Action** : Créer le gateway de chat.

```bash
nest g gateway chat
```

```typescript
// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('ChatGateway');
  private users = new Map<string, string>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connecte: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const username = this.users.get(client.id);
    this.users.delete(client.id);
    if (username) {
      this.server.emit('userLeft', { username, timestamp: new Date() });
    }
    this.logger.log(`Client deconnecte: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { username: string },
  ) {
    this.users.set(client.id, data.username);
    client.broadcast.emit('userJoined', {
      username: data.username,
      timestamp: new Date(),
    });
    return { event: 'joined', data: { users: Array.from(this.users.values()) } };
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { text: string },
  ) {
    const username = this.users.get(client.id) || 'Anonyme';
    const message = {
      username,
      text: data.text,
      timestamp: new Date(),
    };
    this.server.emit('newMessage', message);
    return message;
  }
}
```

> Le decorateur `@WebSocketGateway` fait de cette classe un serveur WebSocket. `@SubscribeMessage` ecoute un événement spécifique. `handleConnection` et `handleDisconnect` gerent les connexions.

**Action** : Créer une page HTML de test pour le chat.

```html
<!-- public/chat.html -->
<!DOCTYPE html>
<html>
<head><title>Chat NestJS</title></head>
<body>
  <h1>Chat en temps reel</h1>
  <div id="messages" style="height:300px;overflow-y:auto;border:1px solid #ccc;padding:10px;"></div>
  <input id="input" type="text" placeholder="Votre message..." />
  <button onclick="sendMessage()">Envoyer</button>

  <script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
  <script>
    const socket = io('http://localhost:3000/chat');
    const username = prompt('Votre nom ?') || 'Anonyme';

    socket.emit('join', { username });

    socket.on('newMessage', (msg) => {
      const div = document.getElementById('messages');
      div.innerHTML += `<p><strong>${msg.username}:</strong> ${msg.text}</p>`;
      div.scrollTop = div.scrollHeight;
    });

    socket.on('userJoined', (data) => {
      const div = document.getElementById('messages');
      div.innerHTML += `<p><em>${data.username} a rejoint le chat</em></p>`;
    });

    function sendMessage() {
      const input = document.getElementById('input');
      socket.emit('message', { text: input.value });
      input.value = '';
    }
  </script>
</body>
</html>
  ```

**Action** : Ouvrir deux onglets de navigateur et tester le chat.

> On voit les messages apparaître en temps réel dans les deux onglets. La connexion WebSocket reste ouverte, pas besoin de polling. C'est instantane.

### [08:00-12:00] Upload de fichiers avec Multer

> Deuxieme sujet : l'upload de fichiers. NestJS utilise Multer sous le capot.

**Action** : Installer les types et configurer l'upload.

```bash
npm install @types/multer
```

```typescript
// src/files/files.controller.ts
import {
  Controller, Post, Get, Param, Res,
  UseInterceptors, UploadedFile, UploadedFiles,
  ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';

const storage = diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueName}${extname(file.originalname)}`);
  },
});

@Controller('files')
export class FilesController {
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage }))
  uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5 MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|pdf)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return {
      message: 'Fichier uploade',
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Post('upload-multiple')
  @UseInterceptors(FilesInterceptor('files', 5, { storage }))
  uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    return {
      message: `${files.length} fichiers uploades`,
      files: files.map(f => ({ filename: f.filename, size: f.size })),
    };
  }

  @Get(':filename')
  getFile(@Param('filename') filename: string, @Res() res: Response) {
    return res.sendFile(filename, { root: './uploads' });
  }
}
```

**Action** : Créer le dossier uploads et tester.

```bash
mkdir uploads
```

```bash
# Upload simple
curl -F "file=@photo.jpg" http://localhost:3000/files/upload

# Upload multiple
curl -F "files=@photo1.jpg" -F "files=@photo2.jpg" http://localhost:3000/files/upload-multiple

# Telecharger
curl http://localhost:3000/files/nom-du-fichier.jpg --output test.jpg
```

> `FileInterceptor` géré l'upload d'un seul fichier. `FilesInterceptor` géré l'upload multiple. `ParseFilePipe` valide la taille et le type. Le stockage sur disque est configure avec Multer.

### [12:00-16:00] Rooms WebSocket et intégration

> Revenons aux WebSockets pour voir les rooms — des sous-groupes de connexions.

**Action** : Ajouter les rooms au gateway.

```typescript
// Dans chat.gateway.ts
@SubscribeMessage('joinRoom')
handleJoinRoom(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { room: string },
) {
  client.join(data.room);
  this.server.to(data.room).emit('roomMessage', {
    text: `${this.users.get(client.id)} a rejoint la room ${data.room}`,
    timestamp: new Date(),
  });
  return { event: 'roomJoined', data: { room: data.room } };
}

@SubscribeMessage('roomMessage')
handleRoomMessage(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { room: string; text: string },
) {
  const username = this.users.get(client.id) || 'Anonyme';
  this.server.to(data.room).emit('roomMessage', {
    username,
    text: data.text,
    room: data.room,
    timestamp: new Date(),
  });
}
```

> Les rooms permettent d'envoyer des messages à un sous-ensemble de clients. Utile pour des channels de chat, des notifications par groupe, ou des tableaux de bord par équipe.

### [16:00-19:00] Recap

> Les WebSockets avec NestJS utilisent les Gateways et Socket.IO pour la communication temps réel. L'upload de fichiers utilise Multer avec validation via ParseFilePipe. Les rooms permettent de segmenter les connexions.

**Action** : Afficher le slide recap.

> Le lab est dans `labs/lab-21-websockets/`. Vous allez construire un chat complet avec rooms et un système d'upload de fichiers. Au prochain screencast, les queues et les taches planifiees !

## Points d'attention pour l'enregistrement
- Avoir deux fenêtres de navigateur cote a cote pour la demo du chat
- Preparer un fichier image pour la demo d'upload
- Montrer le dossier uploads/ avec le fichier renomme
- Les WebSockets necessitent que le serveur tourne — ne pas le couper pendant la demo
