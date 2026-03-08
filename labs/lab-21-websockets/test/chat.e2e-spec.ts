import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { AppModule } from '../src/app.module';

describe('ChatGateway (e2e)', () => {
  let app: INestApplication;
  let clientSocket1: ClientSocket;
  let clientSocket2: ClientSocket;
  let port: number;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0);

    const url = await app.getUrl();
    port = parseInt(url.split(':').pop(), 10);
  });

  afterEach(async () => {
    if (clientSocket1?.connected) clientSocket1.disconnect();
    if (clientSocket2?.connected) clientSocket2.disconnect();
    await app.close();
  });

  function connectClient(username: string): Promise<ClientSocket> {
    return new Promise((resolve) => {
      const socket = io(`http://localhost:${port}`, {
        query: { username },
        transports: ['websocket'],
      });
      socket.on('connect', () => resolve(socket));
    });
  }

  it('should allow a client to connect', async () => {
    clientSocket1 = await connectClient('Alice');
    expect(clientSocket1.connected).toBe(true);
  });

  it('should allow joining a room', async () => {
    clientSocket1 = await connectClient('Alice');

    const result = await new Promise<any>((resolve) => {
      clientSocket1.emit('joinRoom', { room: 'general' }, (response) => {
        resolve(response);
      });
    });

    // The handler should return message history (empty at first)
    expect(result).toBeDefined();
  });

  it('should broadcast messages to room members', async () => {
    clientSocket1 = await connectClient('Alice');
    clientSocket2 = await connectClient('Bob');

    // Both join the same room
    await new Promise<void>((resolve) => {
      clientSocket1.emit('joinRoom', { room: 'general' }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      clientSocket2.emit('joinRoom', { room: 'general' }, () => resolve());
    });

    // Set up listener on client2
    const messagePromise = new Promise<any>((resolve) => {
      clientSocket2.on('newMessage', (msg) => resolve(msg));
    });

    // Client1 sends a message
    clientSocket1.emit('message', { room: 'general', content: 'Hello!' });

    const receivedMessage = await messagePromise;
    expect(receivedMessage).toBeDefined();
    expect(receivedMessage.content).toBe('Hello!');
    expect(receivedMessage.sender).toBe('Alice');
  });

  it('should notify when user joins room', async () => {
    clientSocket1 = await connectClient('Alice');

    // Alice joins first
    await new Promise<void>((resolve) => {
      clientSocket1.emit('joinRoom', { room: 'general' }, () => resolve());
    });

    // Set up listener for userJoined
    const joinPromise = new Promise<any>((resolve) => {
      clientSocket1.on('userJoined', (data) => resolve(data));
    });

    // Bob joins
    clientSocket2 = await connectClient('Bob');
    await new Promise<void>((resolve) => {
      clientSocket2.emit('joinRoom', { room: 'general' }, () => resolve());
    });

    const joinData = await joinPromise;
    expect(joinData.username).toBe('Bob');
    expect(joinData.room).toBe('general');
  });

  it('should send direct messages', async () => {
    clientSocket1 = await connectClient('Alice');
    clientSocket2 = await connectClient('Bob');

    const dmPromise = new Promise<any>((resolve) => {
      clientSocket2.on('newMessage', (msg) => resolve(msg));
    });

    clientSocket1.emit('directMessage', {
      targetClientId: clientSocket2.id,
      content: 'Private hello!',
    });

    const dm = await dmPromise;
    expect(dm).toBeDefined();
    expect(dm.content).toBe('Private hello!');
  });
});
