// app.module.ts — DONNÉ. Assemble le module que tu écris. Ne se modifie pas.
import { Module } from "@nestjs/common";
import { FamiliesModule } from "./families/families.module";

@Module({ imports: [FamiliesModule] })
export class AppModule {}
