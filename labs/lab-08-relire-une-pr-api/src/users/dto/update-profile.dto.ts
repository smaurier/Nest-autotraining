// update-profile.dto.ts — LA PR SOUMISE PAR UN COLLÈGUE, PRÊTE À ÊTRE MERGÉE. Relis-la
// AVANT de regarder le service ou le controller (voir README § Étapes) — écris tes findings
// avant de savoir si tu as raison.
import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() bio?: string;
  // Le collègue a ajouté ce champ "pour permettre aux admins de se gérer entre eux plus tard" —
  // en attendant, RIEN dans le controller ne vérifie qui a le droit de le poser.
  @IsOptional() @IsIn(["member", "admin"]) role?: string;
}
