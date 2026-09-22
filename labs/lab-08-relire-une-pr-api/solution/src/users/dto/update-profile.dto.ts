// update-profile.dto.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
// Fix #1 : `role` retiré du DTO. Ce n'est PAS une route de gestion des rôles — une route de
// gestion des rôles, si elle existe un jour, sera une route SÉPARÉE, avec sa propre
// autorisation (réservée aux admins). Un profil ne s'auto-élève jamais.
import { IsOptional, IsString } from "class-validator";

export class UpdateProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() bio?: string;
}
