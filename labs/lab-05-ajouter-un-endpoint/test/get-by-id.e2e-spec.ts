// get-by-id.e2e-spec.ts — ORACLE DE LA NOUVELLE CAPACITÉ. RED avant ta modification, GREEN
// après. Ne pas modifier.
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("GET /posts/:id — nouvelle capacité", () => {
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

  it("renvoie le post seedé p1 avec la forme exacte du contrat", async () => {
    const res = await request(app.getHttpServer()).get("/posts/p1");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "p1", familyId: "f1", content: "Pique-nique dimanche" });
    expect(Object.keys(res.body).sort()).toEqual(["authorId", "content", "createdAt", "familyId", "id"].sort());
  });

  it("404 pour un id inconnu", async () => {
    const res = await request(app.getHttpServer()).get("/posts/zzz");
    expect(res.status).toBe(404);
  });

  it("un post créé via POST est immédiatement trouvable via GET /posts/:id", async () => {
    const cree = await request(app.getHttpServer())
      .post("/posts")
      .send({ familyId: "f1", authorId: "u4", content: "Trouvable ensuite" });
    const res = await request(app.getHttpServer()).get(`/posts/${cree.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.content).toBe("Trouvable ensuite");
  });
});
