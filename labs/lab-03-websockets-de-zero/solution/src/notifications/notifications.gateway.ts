// notifications.gateway.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { WebSocketGateway, WebSocketServer, SubscribeMessage, WsException } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { randomUUID } from "node:crypto";

@WebSocketGateway({ cors: { origin: "*" } })
export class NotificationsGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage("join")
  handleJoin(client: Socket, familyId: string): void {
    // Une room socket.io = un canal de diffusion. Rejoindre = s'abonner aux futurs "post:created"
    // de CETTE famille, sans jamais voir ceux des autres familles.
    client.join(familyId);
  }

  @SubscribeMessage("post:create")
  handlePostCreate(client: Socket, payload: { familyId: string; content: string }): void {
    if (!payload.content?.trim()) {
      // WsException → Nest émet automatiquement un event "exception" au client, avec le
      // message. On ne lève JAMAIS une Error nue ici : elle ferait planter le handler sans
      // rien renvoyer au client (mauvaise expérience, impossible à tester proprement).
      throw new WsException("content requis");
    }
    const post = {
      id: randomUUID(),
      familyId: payload.familyId,
      content: payload.content,
      createdAt: new Date().toISOString(),
    };
    // Diffuse à TOUTE la room, émetteur inclus : le flux temps réel EST la confirmation,
    // pas un ack séparé — plus simple côté client (un seul chemin d'affichage).
    this.server.to(payload.familyId).emit("post:created", post);
  }
}
