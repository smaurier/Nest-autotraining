// families.module.ts — SOLUTION DE RÉFÉRENCE. Ne l'ouvre pas avant ton GREEN.
import { Module } from "@nestjs/common";
import { FamiliesController } from "./families.controller";
import { FamiliesService } from "./families.service";
import { FamiliesRepository } from "./families.repository";

@Module({
  controllers: [FamiliesController],
  providers: [FamiliesService, FamiliesRepository],
})
export class FamiliesModule {}
