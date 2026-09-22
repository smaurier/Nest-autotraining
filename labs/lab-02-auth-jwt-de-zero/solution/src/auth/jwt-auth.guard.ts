// jwt-auth.guard.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return false;
    const token = header.slice("Bearer ".length);
    try {
      // verify() lève si le token est invalide, expiré, ou signé avec un autre secret —
      // un Guard ne laisse JAMAIS une exception remonter telle quelle (ce serait un 500).
      const payload = this.jwtService.verify(token);
      (request as Request & { user?: unknown }).user = payload;
      return true;
    } catch {
      return false;
    }
  }
}
