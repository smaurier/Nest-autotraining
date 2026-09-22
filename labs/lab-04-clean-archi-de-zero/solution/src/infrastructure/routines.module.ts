// routines.module.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { Module } from "@nestjs/common";
import { RoutinesController } from "./routines.controller";
import { CompleteRoutineUseCase } from "../application/complete-routine.usecase";
import { InMemoryRoutineRepository } from "./in-memory-routine.repository";
import { ROUTINE_REPOSITORY } from "../domain/routine.repository.port";

@Module({
  controllers: [RoutinesController],
  providers: [
    CompleteRoutineUseCase,
    // La ligne qui matérialise l'inversion de dépendance : le PORT (jeton) est branché sur
    // SON implémentation concrète, ici et nulle part ailleurs.
    { provide: ROUTINE_REPOSITORY, useClass: InMemoryRoutineRepository },
  ],
})
export class RoutinesModule {}
