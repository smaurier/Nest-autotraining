// app.module.ts — DONNÉ. Assemble le module que tu écris. Ne se modifie pas.
import { Module } from "@nestjs/common";
import { RoutinesModule } from "./infrastructure/routines.module";

@Module({ imports: [RoutinesModule] })
export class AppModule {}
