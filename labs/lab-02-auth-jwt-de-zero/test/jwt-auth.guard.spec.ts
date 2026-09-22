// jwt-auth.guard.spec.ts — Oracle UNITAIRE du Guard, JwtService réel (pas de HTTP, juste
// signature/vérification de tokens en mémoire). Ne pas modifier.
import type { ExecutionContext } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";

function contextAvecAuthHeader(authorization?: string): ExecutionContext {
  const request: Record<string, unknown> = { headers: authorization ? { authorization } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("JwtAuthGuard", () => {
  const jwtService = new JwtService({ secret: "test-secret" });
  const guard = new JwtAuthGuard(jwtService);

  it("refuse sans en-tête Authorization", () => {
    expect(guard.canActivate(contextAvecAuthHeader(undefined))).toBe(false);
  });

  it("refuse un en-tête qui n'est pas au format Bearer", () => {
    expect(guard.canActivate(contextAvecAuthHeader("Basic abcdef"))).toBe(false);
  });

  it("refuse un token invalide (signature incorrecte)", () => {
    const autreJwt = new JwtService({ secret: "autre-secret" });
    const token = autreJwt.sign({ sub: "u1" });
    expect(guard.canActivate(contextAvecAuthHeader(`Bearer ${token}`))).toBe(false);
  });

  it("refuse un token expiré", () => {
    const token = jwtService.sign({ sub: "u1" }, { expiresIn: "-1s" });
    expect(guard.canActivate(contextAvecAuthHeader(`Bearer ${token}`))).toBe(false);
  });

  it("accepte un token valide et pose request.user avec le payload", () => {
    const token = jwtService.sign({ sub: "u1", email: "bob@tribuzen.app" });
    const context = contextAvecAuthHeader(`Bearer ${token}`);
    expect(guard.canActivate(context)).toBe(true);
    const request = context.switchToHttp().getRequest<{ user?: { sub: string; email: string } }>();
    expect(request.user?.sub).toBe("u1");
    expect(request.user?.email).toBe("bob@tribuzen.app");
  });
});
