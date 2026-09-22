// app.e2e-spec.ts — Oracle E2E. La vraie app Nest, de vraies requêtes HTTP (supertest),
// le vrai ValidationPipe global. Ne pas modifier.
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { API_KEY } from "../src/families/api-key.guard";

describe("Families API (e2e)", () => {
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

  it("POST /families crée une famille (201)", async () => {
    const res = await request(app.getHttpServer()).post("/families").send({ name: "Dupont" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Dupont", members: [] });
    expect(typeof res.body.id).toBe("string");
  });

  it("POST /families rejette un name vide (400, DTO invalide)", async () => {
    const res = await request(app.getHttpServer()).post("/families").send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("POST /families/:id/members sans x-api-key → 403", async () => {
    const famille = await request(app.getHttpServer()).post("/families").send({ name: "Martin" });
    const res = await request(app.getHttpServer())
      .post(`/families/${famille.body.id}/members`)
      .send({ email: "bob@tribuzen.app", role: "parent" });
    expect(res.status).toBe(403);
  });

  it("POST /families/:id/members avec la bonne clé → 201, puis GET liste le membre", async () => {
    const famille = await request(app.getHttpServer()).post("/families").send({ name: "Bernard" });
    const ajout = await request(app.getHttpServer())
      .post(`/families/${famille.body.id}/members`)
      .set("x-api-key", API_KEY)
      .send({ email: "chloe@tribuzen.app", role: "enfant" });
    expect(ajout.status).toBe(201);
    expect(ajout.body).toMatchObject({ email: "chloe@tribuzen.app", role: "enfant" });

    const liste = await request(app.getHttpServer()).get(`/families/${famille.body.id}/members`);
    expect(liste.status).toBe(200);
    expect(liste.body).toHaveLength(1);
    expect(liste.body[0].email).toBe("chloe@tribuzen.app");
  });

  it("un email au mauvais format est rejeté par le DTO (400), pas par le service", async () => {
    const famille = await request(app.getHttpServer()).post("/families").send({ name: "Petit" });
    const res = await request(app.getHttpServer())
      .post(`/families/${famille.body.id}/members`)
      .set("x-api-key", API_KEY)
      .send({ email: "pas-un-email", role: "parent" });
    expect(res.status).toBe(400);
  });

  it("un role hors énumération est rejeté par le DTO (400)", async () => {
    const famille = await request(app.getHttpServer()).post("/families").send({ name: "Roux" });
    const res = await request(app.getHttpServer())
      .post(`/families/${famille.body.id}/members`)
      .set("x-api-key", API_KEY)
      .send({ email: "x@t.fr", role: "grand-parent" });
    expect(res.status).toBe(400);
  });

  it("ajouter un doublon d'email dans la même famille → 409", async () => {
    const famille = await request(app.getHttpServer()).post("/families").send({ name: "Simon" });
    await request(app.getHttpServer())
      .post(`/families/${famille.body.id}/members`)
      .set("x-api-key", API_KEY)
      .send({ email: "dup@t.fr", role: "parent" });
    const res = await request(app.getHttpServer())
      .post(`/families/${famille.body.id}/members`)
      .set("x-api-key", API_KEY)
      .send({ email: "dup@t.fr", role: "enfant" });
    expect(res.status).toBe(409);
  });

  it("GET /families/:id/members sur une famille inconnue → 404", async () => {
    const res = await request(app.getHttpServer()).get("/families/00000000-0000-0000-0000-000000000000/members");
    expect(res.status).toBe(404);
  });
});
