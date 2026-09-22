// families.service.spec.ts — Oracle UNITAIRE. Repository MOCKÉ (jamais le vrai stockage) —
// c'est le point du test unitaire : isoler la RÈGLE MÉTIER de son stockage. Ne pas modifier.
import { Test } from "@nestjs/testing";
import { NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { FamiliesService } from "../src/families/families.service";
import { FamiliesRepository, type Family } from "../src/families/families.repository";

describe("FamiliesService", () => {
  let service: FamiliesService;
  let repo: { create: jest.Mock; findById: jest.Mock; addMember: jest.Mock };

  beforeEach(async () => {
    repo = { create: jest.fn(), findById: jest.fn(), addMember: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [FamiliesService, { provide: FamiliesRepository, useValue: repo }],
    }).compile();
    service = module.get(FamiliesService);
  });

  it("createFamily délègue au repository", () => {
    const famille: Family = { id: "f1", name: "Dupont", members: [] };
    repo.create.mockReturnValue(famille);
    expect(service.createFamily("Dupont")).toBe(famille);
    expect(repo.create).toHaveBeenCalledWith("Dupont");
  });

  it("getFamily lève NotFoundException si absente", () => {
    repo.findById.mockReturnValue(undefined);
    expect(() => service.getFamily("zzz")).toThrow(NotFoundException);
  });

  it("addMember : NotFoundException si la famille n'existe pas", () => {
    repo.findById.mockReturnValue(undefined);
    expect(() => service.addMember("zzz", { email: "a@t.fr", role: "parent" })).toThrow(NotFoundException);
    expect(repo.addMember).not.toHaveBeenCalled();
  });

  it("addMember : ConflictException si l'email est déjà membre (insensible à la casse)", () => {
    const famille: Family = { id: "f1", name: "Dupont", members: [{ id: "m1", email: "a@t.fr", role: "parent" }] };
    repo.findById.mockReturnValue(famille);
    expect(() => service.addMember("f1", { email: "A@T.FR", role: "enfant" })).toThrow(ConflictException);
    expect(repo.addMember).not.toHaveBeenCalled();
  });

  it("addMember : BadRequestException au 21e membre (quota 20)", () => {
    const membres = Array.from({ length: 20 }, (_, i) => ({ id: `m${i}`, email: `m${i}@t.fr`, role: "enfant" }));
    const famille: Family = { id: "f1", name: "Dupont", members: membres };
    repo.findById.mockReturnValue(famille);
    expect(() => service.addMember("f1", { email: "nouveau@t.fr", role: "enfant" })).toThrow(BadRequestException);
    expect(repo.addMember).not.toHaveBeenCalled();
  });

  it("addMember : cas nominal, délègue au repository et renvoie le membre créé", () => {
    const famille: Family = { id: "f1", name: "Dupont", members: [] };
    const cree = { id: "m1", email: "bob@t.fr", role: "parent" };
    repo.findById.mockReturnValue(famille);
    repo.addMember.mockReturnValue(cree);
    expect(service.addMember("f1", { email: "bob@t.fr", role: "parent" })).toBe(cree);
    expect(repo.addMember).toHaveBeenCalledWith("f1", { email: "bob@t.fr", role: "parent" });
  });

  it("listMembers : NotFoundException si la famille n'existe pas, sinon la liste", () => {
    repo.findById.mockReturnValue(undefined);
    expect(() => service.listMembers("zzz")).toThrow(NotFoundException);

    const famille: Family = { id: "f1", name: "Dupont", members: [{ id: "m1", email: "a@t.fr", role: "parent" }] };
    repo.findById.mockReturnValue(famille);
    expect(service.listMembers("f1")).toEqual(famille.members);
  });
});
