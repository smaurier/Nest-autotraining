// auth.service.spec.ts — Oracle UNITAIRE. Repository, PasswordService, JwtService MOCKÉS.
// Ne pas modifier.
import { Test } from "@nestjs/testing";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "../src/auth/auth.service";
import { UsersRepository } from "../src/users/users.repository";
import { PasswordService } from "../src/auth/password.service";

describe("AuthService", () => {
  let service: AuthService;
  let repo: { findByEmail: jest.Mock; create: jest.Mock };
  let passwordService: { hash: jest.Mock; compare: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    repo = { findByEmail: jest.fn(), create: jest.fn() };
    passwordService = { hash: jest.fn(), compare: jest.fn() };
    jwtService = { signAsync: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersRepository, useValue: repo },
        { provide: PasswordService, useValue: passwordService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe("register", () => {
    it("hash le mot de passe et crée l'utilisateur, ne renvoie jamais le hash", async () => {
      repo.findByEmail.mockReturnValue(undefined);
      passwordService.hash.mockResolvedValue("HASHED");
      repo.create.mockReturnValue({ id: "u1", email: "bob@tribuzen.app", passwordHash: "HASHED" });

      const result = await service.register("bob@tribuzen.app", "motdepasse123");

      expect(passwordService.hash).toHaveBeenCalledWith("motdepasse123");
      expect(repo.create).toHaveBeenCalledWith({ email: "bob@tribuzen.app", passwordHash: "HASHED" });
      expect(result).toEqual({ id: "u1", email: "bob@tribuzen.app" });
      expect((result as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it("ConflictException si l'email existe déjà", async () => {
      repo.findByEmail.mockReturnValue({ id: "u1", email: "bob@tribuzen.app", passwordHash: "x" });
      await expect(service.register("bob@tribuzen.app", "motdepasse123")).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("UnauthorizedException si l'email est inconnu", async () => {
      repo.findByEmail.mockReturnValue(undefined);
      await expect(service.login("inconnu@tribuzen.app", "x")).rejects.toThrow(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it("UnauthorizedException si le mot de passe est faux, AVEC LE MÊME message que email inconnu", async () => {
      repo.findByEmail.mockReturnValue({ id: "u1", email: "bob@tribuzen.app", passwordHash: "HASHED" });
      passwordService.compare.mockResolvedValue(false);

      let messageEmailInconnu = "";
      repo.findByEmail.mockReturnValueOnce(undefined);
      try {
        await service.login("inconnu@tribuzen.app", "x");
      } catch (e) {
        messageEmailInconnu = (e as Error).message;
      }

      repo.findByEmail.mockReturnValue({ id: "u1", email: "bob@tribuzen.app", passwordHash: "HASHED" });
      let messageMotDePasseFaux = "";
      try {
        await service.login("bob@tribuzen.app", "faux");
      } catch (e) {
        messageMotDePasseFaux = (e as Error).message;
      }

      expect(messageEmailInconnu).not.toBe("");
      expect(messageEmailInconnu).toBe(messageMotDePasseFaux);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it("cas nominal : émet un token dont le payload contient sub et email", async () => {
      repo.findByEmail.mockReturnValue({ id: "u1", email: "bob@tribuzen.app", passwordHash: "HASHED" });
      passwordService.compare.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue("un.jwt.token");

      const result = await service.login("bob@tribuzen.app", "motdepasse123");

      expect(passwordService.compare).toHaveBeenCalledWith("motdepasse123", "HASHED");
      expect(jwtService.signAsync).toHaveBeenCalledWith(expect.objectContaining({ sub: "u1", email: "bob@tribuzen.app" }));
      expect(result).toEqual({ accessToken: "un.jwt.token" });
    });
  });
});
