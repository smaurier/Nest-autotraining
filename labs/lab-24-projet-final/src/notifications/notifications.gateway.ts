import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

// TODO: Implement the WebSocket gateway
//   @WebSocketGateway({ cors: { origin: '*' } })
//
//   - Declare @WebSocketServer() server: Server
//   - Implement OnGatewayConnection: log when a client connects
//   - Implement OnGatewayDisconnect: log when a client disconnects
//
//   - notifyOrderCreated(order: any):
//     this.server.emit('order:created', order)
//
//   - notifyOrderStatusChanged(order: any):
//     this.server.emit('order:status-changed', order)

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('NotificationsGateway');

  handleConnection(client: Socket) {
    // TODO: log connection
  }

  handleDisconnect(client: Socket) {
    // TODO: log disconnection
  }

  notifyOrderCreated(order: any) {
    // TODO: emit 'order:created' event
  }

  notifyOrderStatusChanged(order: any) {
    // TODO: emit 'order:status-changed' event
  }
}
