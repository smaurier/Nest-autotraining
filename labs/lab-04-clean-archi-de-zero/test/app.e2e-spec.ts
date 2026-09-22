// app.e2e-spec.ts — TEST DE FRONTIÈRE n°3 : e2e, la vraie app avec le VRAI câblage (le port
// branché sur InMemoryRoutineRepository via le module). Ne pas modifier.
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("Routines API (e2e)", () => {
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

  it("POST /routines/brossage/complete → 201, streak 1 le premier jour", async () => {
    const res = await request(app.getHttpServer()).post("/routines/brossage/complete").send({ today: "2026-01-01" });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ routineId: "brossage", streak: 1 });
  });

  it("le lendemain, la streak monte à 2 (état conservé entre les requêtes)", async () => {
    const res = await request(app.getHttpServer()).post("/routines/brossage/complete").send({ today: "2026-01-02" });
    expect(res.status).toBe(201);
    expect(res.body.streak).toBe(2);
  });

  it("un jour SAUTÉ casse la streak au prochain complete", async () => {
    // saute le 2026-01-03, reprend le 2026-01-04
    const res = await request(app.getHttpServer()).post("/routines/brossage/complete").send({ today: "2026-01-04" });
    expect(res.status).toBe(201);
    expect(res.body.streak).toBe(1);
  });

  it("routine inconnue → 404", async () => {
    const res = await request(app.getHttpServer()).post("/routines/inconnue/complete").send({ today: "2026-01-01" });
    expect(res.status).toBe(404);
  });

  it("date au mauvais format → 400 (DTO)", async () => {
    const res = await request(app.getHttpServer()).post("/routines/brossage/complete").send({ today: "pas-une-date" });
    expect(res.status).toBe(400);
  });
});
