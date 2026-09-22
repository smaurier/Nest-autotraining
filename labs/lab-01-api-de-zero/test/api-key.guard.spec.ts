// api-key.guard.spec.ts — Oracle UNITAIRE du Guard, isolé du reste de l'app. Ne pas modifier.
import type { ExecutionContext } from "@nestjs/common";
import { ApiKeyGuard, API_KEY } from "../src/families/api-key.guard";

function contextAvecHeaders(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe("ApiKeyGuard", () => {
  const guard = new ApiKeyGuard();

  it("autorise quand x-api-key est correct", () => {
    expect(guard.canActivate(contextAvecHeaders({ "x-api-key": API_KEY }))).toBe(true);
  });

  it("refuse quand la clé est absente", () => {
    expect(guard.canActivate(contextAvecHeaders({}))).toBe(false);
  });

  it("refuse quand la clé est fausse", () => {
    expect(guard.canActivate(contextAvecHeaders({ "x-api-key": "wrong" }))).toBe(false);
  });
});
