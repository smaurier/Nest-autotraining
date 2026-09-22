// pr-review.e2e-spec.ts — ORACLE DES DEUX PROBLÈMES DE LA PR. RED sur le starter (les deux
// problèmes sont réels), GREEN après ta correction. Ne pas modifier.
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("PATCH /users/:id/profile — findings de la revue", () => {
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

  it("sur-affectation de masse : envoyer role=\"admin\" ne doit JAMAIS élever le rôle", async () => {
    const res = await request(app.getHttpServer())
      .patch("/users/u1/profile")
      .send({ name: "Alice", role: "admin" });
    // Deux issues légitimes selon le choix de conception : soit le champ est ignoré (200,
    // role toujours "member"), soit le DTO le rejette carrément (400, whitelist stricte).
    // Ce qui est INTERDIT dans les deux cas : que role devienne "admin".
    if (res.status === 200) {
      expect(res.body.role).toBe("member");
    } else {
      expect(res.status).toBe(400);
    }
  });

  it("fuite de données sensibles : la réponse ne contient JAMAIS passwordHash", async () => {
    const res = await request(app.getHttpServer()).patch("/users/u1/profile").send({ bio: "test" });
    expect(res.status).toBe(200);
    expect(res.body.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/hash-secret/);
  });
});
