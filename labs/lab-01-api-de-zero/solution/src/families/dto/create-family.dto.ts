// create-family.dto.ts — SOLUTION DE RÉFÉRENCE. Ne l'ouvre pas avant ton GREEN.
import { IsNotEmpty, IsString } from "class-validator";

export class CreateFamilyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}
