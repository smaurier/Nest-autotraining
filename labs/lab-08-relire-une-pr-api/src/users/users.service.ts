// users.service.ts — LA PR (suite). Ne réfléchis pas encore à "comment corriger" — d'abord,
// comprends ce que fait CE code, précisément, avec les vraies données qu'il manipule.
import { Injectable, NotFoundException } from "@nestjs/common";
import { UsersRepository } from "./users.repository";
import type { User } from "./user.model";
import type { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  updateProfile(id: string, dto: UpdateProfileDto): User {
    const user = this.repository.findById(id);
    if (!user) throw new NotFoundException(`User ${id} introuvable`);
    // Chaque champ présent dans le DTO écrase le champ correspondant sur l'utilisateur.
    const updated: User = { ...user, ...dto } as User;
    return this.repository.save(updated);
  }
}
