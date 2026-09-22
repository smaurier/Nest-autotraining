// app.e2e-spec.ts — Oracle E2E. La vraie app, un vrai serveur socket.io, de vrais clients
// (socket.io-client) qui se connectent par le réseau (localhost). Ne pas modifier.
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { io, type Socket } from "socket.io-client";
import { AppModule } from "../src/app.module";

function attendre(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function attendreUnEvent<T = unknown>(socket: Socket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout en attendant "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe("Notifications Gateway (e2e)", () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === "object" && address ? address.port : 0;
    url = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  function connecter(): Socket {
    return io(url, { transports: ["websocket"], forceNew: true });
  }

  it("un client dans la room reçoit un post créé dans SA famille", async () => {
    const client = connecter();
    await attendreUnEvent(client, "connect");
    client.emit("join", "famille-alpha");
    await attendre(50);

    const reçu = attendreUnEvent<{ content: string; familyId: string }>(client, "post:created");
    client.emit("post:create", { familyId: "famille-alpha", content: "Pique-nique dimanche" });
    const post = await reçu;

    expect(post.familyId).toBe("famille-alpha");
    expect(post.content).toBe("Pique-nique dimanche");
    client.disconnect();
  });

  it("deux clients dans la même room reçoivent tous les deux (diffusion réelle)", async () => {
    const alice = connecter();
    const bob = connecter();
    await Promise.all([attendreUnEvent(alice, "connect"), attendreUnEvent(bob, "connect")]);
    alice.emit("join", "famille-beta");
    bob.emit("join", "famille-beta");
    await attendre(50);

    const aliceReçoit = attendreUnEvent<{ content: string }>(alice, "post:created");
    const bobReçoit = attendreUnEvent<{ content: string }>(bob, "post:created");
    alice.emit("post:create", { familyId: "famille-beta", content: "Léa a perdu une dent" });

    const [pourAlice, pourBob] = await Promise.all([aliceReçoit, bobReçoit]);
    expect(pourAlice.content).toBe("Léa a perdu une dent");
    expect(pourBob.content).toBe("Léa a perdu une dent");
    alice.disconnect();
    bob.disconnect();
  });

  it("un client d'une AUTRE famille ne reçoit RIEN (les rooms isolent vraiment)", async () => {
    const dansAlpha = connecter();
    const dansGamma = connecter();
    await Promise.all([attendreUnEvent(dansAlpha, "connect"), attendreUnEvent(dansGamma, "connect")]);
    dansAlpha.emit("join", "famille-alpha-2");
    dansGamma.emit("join", "famille-gamma");
    await attendre(50);

    let gammaAReçu = false;
    dansGamma.once("post:created", () => {
      gammaAReçu = true;
    });

    const alphaReçoit = attendreUnEvent(dansAlpha, "post:created");
    dansAlpha.emit("post:create", { familyId: "famille-alpha-2", content: "Message privé alpha" });
    await alphaReçoit;

    // Laisse une chance à un event mal routé d'arriver avant de conclure.
    await new Promise((r) => setTimeout(r, 100));
    expect(gammaAReçu).toBe(false);

    dansAlpha.disconnect();
    dansGamma.disconnect();
  });

  it("un content vide déclenche un event \"exception\", pas de post:created", async () => {
    const client = connecter();
    await attendreUnEvent(client, "connect");
    client.emit("join", "famille-delta");
    await attendre(50);

    const exception = attendreUnEvent<{ message?: string }>(client, "exception");
    client.emit("post:create", { familyId: "famille-delta", content: "   " });
    const payload = await exception;

    expect(JSON.stringify(payload)).toMatch(/content requis/);
    client.disconnect();
  });
});
