// regression.e2e-spec.ts — ORACLE DE NON-RÉGRESSION. VERT avant ta modification. Doit rester
// vert APRÈS. Si un de ces tests casse, c'est ta modification qui a cassé la prod. Ne pas modifier.
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("Posts API — non-régression", () => {
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

  it("GET /posts?familyId=f1 renvoie les 2 posts seedés, forme inchangée", async () => {
    const res = await request(app.getHttpServer()).get("/posts").query({ familyId: "f1" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    for (const post of res.body) {
      expect(Object.keys(post).sort()).toEqual(["authorId", "content", "createdAt", "familyId", "id"].sort());
    }
  });

  it("GET /posts?familyId=inconnue renvoie une liste vide (pas une erreur)", async () => {
    const res = await request(app.getHttpServer()).get("/posts").query({ familyId: "inconnue" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST /posts crée un post (201) avec la forme exacte du contrat", async () => {
    const res = await request(app.getHttpServer())
      .post("/posts")
      .send({ familyId: "f1", authorId: "u3", content: "Nouveau post" });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(["authorId", "content", "createdAt", "familyId", "id"].sort());
    expect(res.body.content).toBe("Nouveau post");
  });

  it("POST /posts avec un content vide → 400 (DTO)", async () => {
    const res = await request(app.getHttpServer()).post("/posts").send({ familyId: "f1", authorId: "u1", content: "" });
    expect(res.status).toBe(400);
  });
});
