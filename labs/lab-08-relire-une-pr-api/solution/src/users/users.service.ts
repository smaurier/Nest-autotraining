// users.service.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { Injectable, NotFoundException } from "@nestjs/common";
import { UsersRepository } from "./users.repository";
import type { User } from "./user.model";
import type { UpdateProfileDto } from "./dto/update-profile.dto";

// Fix #2 : ce que le client reçoit en réponse — jamais le user complet (donc jamais
// passwordHash). Une liste blanche explicite, pas une liste noire (plus sûr : un champ
// sensible ajouté plus tard à User n'est PAS automatiquement exposé).
export interface PublicProfile {
  id: string;
  email: string;
  name: string;
  bio: string;
  role: "member" | "admin";
}

function toPublicProfile(user: User): PublicProfile {
  return { id: user.id, email: user.email, name: user.name, bio: user.bio, role: user.role };
}

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  updateProfile(id: string, dto: UpdateProfileDto): PublicProfile {
    const user = this.repository.findById(id);
    if (!user) throw new NotFoundException(`User ${id} introuvable`);
    // Le DTO (corrigé) n'a plus que name/bio : le spread ne peut plus toucher role/passwordHash/id.
    const updated: User = { ...user, ...dto };
    this.repository.save(updated);
    return toPublicProfile(updated);
  }
}
