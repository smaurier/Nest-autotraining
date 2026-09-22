// notifications.gateway.ts — PAGE BLANCHE. Le WebSocket Gateway temps réel de TribuZen :
// un client rejoint la "room" d'une famille, puis reçoit les posts créés dans cette famille.
// Export attendu : NotificationsGateway, avec :
//
//   @SubscribeMessage("join")
//   handleJoin(client: Socket, familyId: string): void
//     - fait rejoindre au client la room nommée `familyId` (client.join(familyId))
//     - ne renvoie et n'émet RIEN d'autre (pas d'event "joined" attendu par l'oracle)
//
//   @SubscribeMessage("post:create")
//   handlePostCreate(client: Socket, payload: { familyId: string; content: string }): void
//     - si `content` est vide/blanc → lève WsException("content requis") (Nest la transforme
//       automatiquement en event "exception" côté client — ne l'émets pas toi-même)
//     - sinon, diffuse à TOUTE la room `familyId` (this.server.to(familyId).emit(...)) un event
//       "post:created" avec { id: string, familyId: string, content: string, createdAt: string }
//       (createdAt = new Date().toISOString(), id = randomUUID())
//     - le client émetteur fait partie de la room (il a rejoint via "join" avant) : il reçoit
//       aussi l'event, comme tout le monde — c'est voulu (confirmation par le flux, pas par un ack)
//
// Le serveur socket.io est accessible via `@WebSocketServer() server: Server` (propriété de classe).
export {};
