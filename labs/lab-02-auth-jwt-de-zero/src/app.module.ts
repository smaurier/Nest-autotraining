// app.module.ts — DONNÉ. Assemble le module que tu écris. Ne se modifie pas.
import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";

@Module({ imports: [AuthModule] })
export class AppModule {}
