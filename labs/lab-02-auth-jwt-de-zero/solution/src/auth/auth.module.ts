// auth.module.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { UsersRepository } from "../users/users.repository";

@Module({
  imports: [
    // Secret arbitraire pour ce lab (démo) — en vraie mission, il vient d'une variable
    // d'environnement, jamais en dur dans le code (cf module sécurité).
    JwtModule.register({ secret: "lab-02-dev-secret", signOptions: { expiresIn: "1h" } }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, JwtAuthGuard, UsersRepository],
})
export class AuthModule {}
