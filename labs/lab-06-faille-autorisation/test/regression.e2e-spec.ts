// regression.e2e-spec.ts — ORACLE DE NON-RÉGRESSION. Le comportement LÉGITIME doit rester
// vert avant et après ta correction. Ne pas modifier.
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("Posts API — non-régression", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /posts/:id fonctionne pour n'importe qui (lecture publique, hors périmètre du ticket)", async () => {
    const res = await request(app.getHttpServer()).get("/posts/p2");
    expect(res.status).toBe(200);
    expect(res.body.authorId).toBe("bob");
  });

  it("GET sur un id inconnu → 404", async () => {
    const res = await request(app.getHttpServer()).get("/posts/zzz");
    expect(res.status).toBe(404);
  });

  it("DELETE sur un id inconnu → 404 (même pour l'auteur légitime)", async () => {
    const res = await request(app.getHttpServer()).delete("/posts/zzz").set("x-user-id", "alice");
    expect(res.status).toBe(404);
  });
});
