import { Injectable } from '@nestjs/common';

export interface ChatMessage {
  id: string;
  room: string;
  sender: string;
  content: string;
  timestamp: Date;
}

export interface ConnectedUser {
  clientId: string;
  username: string;
  rooms: string[];
}

@Injectable()
export class ChatService {
  private connectedUsers: Map<string, ConnectedUser> = new Map();
  private messageHistory: Map<string, ChatMessage[]> = new Map();

  addUser(clientId: string, username: string): ConnectedUser {
    const user: ConnectedUser = { clientId, username, rooms: [] };
    this.connectedUsers.set(clientId, user);
    return user;
  }

  removeUser(clientId: string): ConnectedUser | undefined {
    const user = this.connectedUsers.get(clientId);
    if (user) {
      this.connectedUsers.delete(clientId);
    }
    return user;
  }

  getUser(clientId: string): ConnectedUser | undefined {
    return this.connectedUsers.get(clientId);
  }

  joinRoom(clientId: string, room: string): ConnectedUser {
    const user = this.connectedUsers.get(clientId);
    if (user && !user.rooms.includes(room)) {
      user.rooms.push(room);
    }
    return user;
  }

  leaveRoom(clientId: string, room: string): ConnectedUser {
    const user = this.connectedUsers.get(clientId);
    if (user) {
      user.rooms = user.rooms.filter((r) => r !== room);
    }
    return user;
  }

  addMessage(room: string, sender: string, content: string): ChatMessage {
    const message: ChatMessage = {
      id: Date.now().toString(),
      room,
      sender,
      content,
      timestamp: new Date(),
    };

    if (!this.messageHistory.has(room)) {
      this.messageHistory.set(room, []);
    }
    this.messageHistory.get(room).push(message);
    return message;
  }

  getMessages(room: string): ChatMessage[] {
    return this.messageHistory.get(room) || [];
  }

  getConnectedUsers(): ConnectedUser[] {
    return Array.from(this.connectedUsers.values());
  }
}
