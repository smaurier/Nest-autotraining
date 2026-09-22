// routines.controller.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { Body, Controller, Param, Post } from "@nestjs/common";
import { CompleteRoutineUseCase } from "../application/complete-routine.usecase";
import { CompleteRoutineDto } from "./dto/complete-routine.dto";

@Controller("routines")
export class RoutinesController {
  constructor(private readonly completeRoutine: CompleteRoutineUseCase) {}

  @Post(":id/complete")
  complete(@Param("id") id: string, @Body() dto: CompleteRoutineDto) {
    // "YYYY-MM-DD" + minuit UTC explicite : jamais laisser le fuseau local du serveur décider
    // de quel "jour" il s'agit (la même leçon de déterminisme que dans tout le cours Testing).
    return this.completeRoutine.execute(id, new Date(`${dto.today}T00:00:00.000Z`));
  }
}
