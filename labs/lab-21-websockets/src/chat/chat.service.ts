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
  // TODO: Declare private storage for connected users and message history
  // Hint: private connectedUsers: Map<string, ConnectedUser> = new Map();
  // Hint: private messageHistory: Map<string, ChatMessage[]> = new Map();

  // TODO: Implement addUser(clientId, username)
  // It should add a user to the connectedUsers map
  // Hint: this.connectedUsers.set(clientId, { clientId, username, rooms: [] });
  addUser(clientId: string, username: string): ConnectedUser {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement removeUser(clientId)
  // It should remove a user from the connectedUsers map
  // Return the removed user or undefined
  removeUser(clientId: string): ConnectedUser | undefined {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement getUser(clientId)
  // It should return the user with the given clientId
  getUser(clientId: string): ConnectedUser | undefined {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement joinRoom(clientId, room)
  // It should add the room to the user's rooms array
  // Return the user
  joinRoom(clientId: string, room: string): ConnectedUser {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement leaveRoom(clientId, room)
  // It should remove the room from the user's rooms array
  // Return the user
  leaveRoom(clientId: string, room: string): ConnectedUser {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement addMessage(room, sender, content)
  // It should create a ChatMessage and add it to the room's message history
  // Return the created message
  // Hint: Generate a unique id with Date.now().toString()
  addMessage(room: string, sender: string, content: string): ChatMessage {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement getMessages(room)
  // It should return all messages for a given room
  // Return empty array if no messages
  getMessages(room: string): ChatMessage[] {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement getConnectedUsers()
  // It should return all connected users as an array
  getConnectedUsers(): ConnectedUser[] {
    throw new Error('TODO: Not implemented');
  }
}
