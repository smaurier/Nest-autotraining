// complete-routine.dto.ts — SOLUTION DE RÉFÉRENCE. Ne l'ouvre pas avant ton GREEN.
import { IsDateString } from "class-validator";

export class CompleteRoutineDto {
  @IsDateString()
  today!: string;
}
