# Lab 21 — WebSockets

## Objectifs

- Creer un serveur WebSocket avec NestJS
- Implementer un chat en temps reel avec des salons (rooms)
- Utiliser les decorateurs @WebSocketGateway, @SubscribeMessage
- Gerer les connexions/deconnexions
- Envoyer des messages directs et en broadcast

## Description

Vous allez creer un serveur de chat en temps reel. Les utilisateurs peuvent :
- Rejoindre et quitter des salons
- Envoyer des messages a un salon
- Envoyer des messages directs a un utilisateur

## Evenements WebSocket

| Evenement     | Direction     | Description                      |
|--------------|--------------|----------------------------------|
| joinRoom     | Client -> Server | Rejoindre un salon             |
| leaveRoom    | Client -> Server | Quitter un salon               |
| message      | Client -> Server | Envoyer un message au salon    |
| directMessage| Client -> Server | Message direct a un client     |
| newMessage   | Server -> Client | Nouveau message recu           |
| userJoined   | Server -> Client | Un utilisateur a rejoint       |
| userLeft     | Server -> Client | Un utilisateur a quitte        |

## Instructions

1. **ChatGateway** (`src/chat/chat.gateway.ts`)
   - Configurez @WebSocketGateway avec cors
   - Implementez handleConnection et handleDisconnect
   - Implementez les handlers pour joinRoom, leaveRoom, message, directMessage

2. **ChatService** (`src/chat/chat.service.ts`)
   - Gerez les utilisateurs connectes
   - Gerez les salons et les membres
   - Stockez l'historique des messages

## Validation

```bash
npm test
```

## Fichiers a modifier

- `src/chat/chat.gateway.ts`
- `src/chat/chat.service.ts`
