// add-member.dto.ts — SOLUTION DE RÉFÉRENCE. Ne l'ouvre pas avant ton GREEN.
import { IsEmail, IsIn } from "class-validator";

export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsIn(["admin", "parent", "enfant"])
  role!: "admin" | "parent" | "enfant";
}
