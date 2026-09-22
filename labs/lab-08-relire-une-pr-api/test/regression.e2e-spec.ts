// regression.e2e-spec.ts — ORACLE DE NON-RÉGRESSION. Le comportement LÉGITIME doit rester
// vert avant et après ta correction. Ne pas modifier.
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("PATCH /users/:id/profile — non-régression", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("met à jour name et bio, renvoie 200", async () => {
    const res = await request(app.getHttpServer()).patch("/users/u1/profile").send({ name: "Alice D.", bio: "Maman de Léa" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Alice D.");
    expect(res.body.bio).toBe("Maman de Léa");
  });

  it("id inconnu → 404", async () => {
    const res = await request(app.getHttpServer()).patch("/users/zzz/profile").send({ name: "X" });
    expect(res.status).toBe(404);
  });

  it("email et id ne bougent jamais, quoi qu'on envoie", async () => {
    const res = await request(app.getHttpServer()).patch("/users/u1/profile").send({ name: "Encore" });
    expect(res.body.id).toBe("u1");
    expect(res.body.email).toBe("alice@tribuzen.app");
  });
});
