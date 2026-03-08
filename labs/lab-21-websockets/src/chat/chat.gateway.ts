import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

// TODO: Configure @WebSocketGateway with CORS enabled
// Hint: @WebSocketGateway({ cors: { origin: '*' } })

// TODO: Implement the ChatGateway class
// It should:
// 1. Implement OnGatewayConnection and OnGatewayDisconnect
// 2. Use @WebSocketServer() to get the server instance
// 3. Inject ChatService

// TODO: Implement handleConnection(client: Socket)
// It should:
// 1. Get the username from the handshake query: client.handshake.query.username
// 2. Add the user to ChatService using addUser(client.id, username)
// 3. Log the connection
// Hint: const username = client.handshake.query.username as string || 'Anonymous';

// TODO: Implement handleDisconnect(client: Socket)
// It should:
// 1. Remove the user from ChatService
// 2. If the user was in rooms, notify those rooms that the user left
// Hint: this.server.to(room).emit('userLeft', { username, room });

// TODO: Implement @SubscribeMessage('joinRoom')
// It should:
// 1. Accept { room: string } in the message body
// 2. Call client.join(room) to join the Socket.IO room
// 3. Call chatService.joinRoom(client.id, room)
// 4. Emit 'userJoined' to the room with { username, room }
// 5. Return the message history for the room
// Hint: @SubscribeMessage('joinRoom') handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { room: string })

// TODO: Implement @SubscribeMessage('leaveRoom')
// It should:
// 1. Accept { room: string }
// 2. Call client.leave(room)
// 3. Call chatService.leaveRoom(client.id, room)
// 4. Emit 'userLeft' to the room

// TODO: Implement @SubscribeMessage('message')
// It should:
// 1. Accept { room: string, content: string }
// 2. Save the message using chatService.addMessage
// 3. Emit 'newMessage' to the room with the message data
// Hint: this.server.to(data.room).emit('newMessage', message);

// TODO: Implement @SubscribeMessage('directMessage')
// It should:
// 1. Accept { targetClientId: string, content: string }
// 2. Emit 'newMessage' directly to the target client
// Hint: this.server.to(data.targetClientId).emit('newMessage', { ... });

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private chatService: ChatService) {}

  handleConnection(client: Socket) {
    throw new Error('TODO: Not implemented');
  }

  handleDisconnect(client: Socket) {
    throw new Error('TODO: Not implemented');
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    throw new Error('TODO: Not implemented');
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    throw new Error('TODO: Not implemented');
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string; content: string },
  ) {
    throw new Error('TODO: Not implemented');
  }

  @SubscribeMessage('directMessage')
  handleDirectMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetClientId: string; content: string },
  ) {
    throw new Error('TODO: Not implemented');
  }
}
