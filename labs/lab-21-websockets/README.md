# Lab 21 — WebSockets

## Objectifs

- Créer un serveur WebSocket avec NestJS
- Implementer un chat en temps réel avec des salons (rooms)
- Utiliser les decorateurs @WebSocketGateway, @SubscribeMessage
- Gérer les connexions/deconnexions
- Envoyer des messages directs et en broadcast

## Description

Vous allez créer un serveur de chat en temps réel. Les utilisateurs peuvent :
- Rejoindre et quitter des salons
- Envoyer des messages à un salon
- Envoyer des messages directs à un utilisateur

## Événements WebSocket

| Événement     | Direction     | Description                      |
|--------------|--------------|----------------------------------|
| joinRoom     | Client -> Server | Rejoindre un salon             |
| leaveRoom    | Client -> Server | Quitter un salon               |
| message      | Client -> Server | Envoyer un message au salon    |
| directMessage| Client -> Server | Message direct à un client     |
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
