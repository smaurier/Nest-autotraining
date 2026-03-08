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
import { ChatService } from '../src/chat/chat.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private chatService: ChatService) {}

  handleConnection(client: Socket) {
    const username = (client.handshake.query.username as string) || 'Anonymous';
    this.chatService.addUser(client.id, username);
    console.log(`Client connected: ${username} (${client.id})`);
  }

  handleDisconnect(client: Socket) {
    const user = this.chatService.removeUser(client.id);
    if (user) {
      user.rooms.forEach((room) => {
        this.server.to(room).emit('userLeft', {
          username: user.username,
          room,
        });
      });
      console.log(`Client disconnected: ${user.username} (${client.id})`);
    }
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    const user = this.chatService.getUser(client.id);
    client.join(data.room);
    this.chatService.joinRoom(client.id, data.room);

    this.server.to(data.room).emit('userJoined', {
      username: user?.username,
      room: data.room,
    });

    return this.chatService.getMessages(data.room);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    const user = this.chatService.getUser(client.id);
    client.leave(data.room);
    this.chatService.leaveRoom(client.id, data.room);

    this.server.to(data.room).emit('userLeft', {
      username: user?.username,
      room: data.room,
    });

    return { event: 'leaveRoom', data: { room: data.room } };
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string; content: string },
  ) {
    const user = this.chatService.getUser(client.id);
    const message = this.chatService.addMessage(
      data.room,
      user?.username || 'Anonymous',
      data.content,
    );

    this.server.to(data.room).emit('newMessage', message);
    return message;
  }

  @SubscribeMessage('directMessage')
  handleDirectMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetClientId: string; content: string },
  ) {
    const sender = this.chatService.getUser(client.id);
    const message = {
      id: Date.now().toString(),
      sender: sender?.username || 'Anonymous',
      content: data.content,
      timestamp: new Date(),
      direct: true,
    };

    this.server.to(data.targetClientId).emit('newMessage', message);
    return message;
  }
}
