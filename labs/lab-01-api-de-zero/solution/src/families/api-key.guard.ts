// api-key.guard.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export const API_KEY = "dev-key";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    // Un Guard renvoie false (jamais d'exception ici) : Nest transforme ça en 403 Forbidden,
    // c'est le statut que l'oracle attend — lever une exception maison donnerait un 500.
    return request.headers["x-api-key"] === API_KEY;
  }
}
