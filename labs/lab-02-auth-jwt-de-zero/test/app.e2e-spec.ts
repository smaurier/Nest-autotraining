// app.e2e-spec.ts — Oracle E2E. La vraie app, de vraies requêtes HTTP. Ne pas modifier.
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("Auth API (e2e)", () => {
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

  it("POST /auth/register crée un compte (201) et ne renvoie jamais le mot de passe/hash", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "alice@tribuzen.app", password: "motdepasse123" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: "alice@tribuzen.app" });
    expect(res.body.password).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("un mot de passe trop court est rejeté par le DTO (400)", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "court@tribuzen.app", password: "1234567" });
    expect(res.status).toBe(400);
  });

  it("un deuxième inscription avec le même email → 409", async () => {
    await request(app.getHttpServer()).post("/auth/register").send({ email: "dup@tribuzen.app", password: "motdepasse123" });
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "dup@tribuzen.app", password: "autremotdepasse" });
    expect(res.status).toBe(409);
  });

  it("GET /auth/me sans token → 403", async () => {
    const res = await request(app.getHttpServer()).get("/auth/me");
    expect(res.status).toBe(403);
  });

  it("login avec un mauvais mot de passe → 401", async () => {
    await request(app.getHttpServer()).post("/auth/register").send({ email: "bob@tribuzen.app", password: "bonmotdepasse" });
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "bob@tribuzen.app", password: "mauvais" });
    expect(res.status).toBe(401);
  });

  it("parcours complet : register → login → me avec le vrai token reçu", async () => {
    await request(app.getHttpServer()).post("/auth/register").send({ email: "chloe@tribuzen.app", password: "motdepasse123" });

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "chloe@tribuzen.app", password: "motdepasse123" });
    expect(login.status).toBe(200);
    expect(typeof login.body.accessToken).toBe("string");
    expect(login.body.accessToken.split(".")).toHaveLength(3); // forme d'un JWT

    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe("chloe@tribuzen.app");
  });

  it("un token bricolé (signature invalide) est refusé sur /auth/me → 403", async () => {
    const res = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", "Bearer ceci.nest.pasunvraitoken");
    expect(res.status).toBe(403);
  });
});
