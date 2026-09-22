// faille.e2e-spec.ts — ORACLE DE LA FAILLE RAPPORTÉE. RED sur le starter (la faille existe
// réellement — ce n'est pas hypothétique), GREEN après ta correction. Ne pas modifier.
//
// Ticket de sécurité : « n'importe quel utilisateur connecté peut supprimer le post de
// n'importe qui d'autre, il suffit de connaître son id. » — IDOR / Broken Object Level
// Authorization (OWASP API Security Top 10, catégorie #1).
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("DELETE /posts/:id — autorisation au niveau de l'objet", () => {
  let app: INestApplication;

  beforeEach(async () => {
    // Une app FRAÎCHE par test : chaque test a sa propre copie des posts seedés (p1/p2),
    // pour que la suppression dans un test ne pollue pas les suivants.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("l'auteur peut supprimer SON PROPRE post (comportement légitime, à préserver)", async () => {
    const res = await request(app.getHttpServer()).delete("/posts/p1").set("x-user-id", "alice");
    expect(res.status).toBe(204);
    const verif = await request(app.getHttpServer()).get("/posts/p1");
    expect(verif.status).toBe(404); // vraiment supprimé
  });

  it("un AUTRE utilisateur ne peut PAS supprimer le post d'alice → 403, et le post survit", async () => {
    const res = await request(app.getHttpServer()).delete("/posts/p1").set("x-user-id", "bob");
    expect(res.status).toBe(403);
    const verif = await request(app.getHttpServer()).get("/posts/p1");
    expect(verif.status).toBe(200); // le post d'alice existe TOUJOURS — pas supprimé par bob
  });

  it("symétrique : alice ne peut pas supprimer le post de bob", async () => {
    const res = await request(app.getHttpServer()).delete("/posts/p2").set("x-user-id", "alice");
    expect(res.status).toBe(403);
    const verif = await request(app.getHttpServer()).get("/posts/p2");
    expect(verif.status).toBe(200);
  });
});
