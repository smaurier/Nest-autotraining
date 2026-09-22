// families.service.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { FamiliesRepository, type Family, type Member } from "./families.repository";

const QUOTA_MEMBRES = 20;

@Injectable()
export class FamiliesService {
  constructor(private readonly repository: FamiliesRepository) {}

  createFamily(name: string): Family {
    return this.repository.create(name);
  }

  getFamily(id: string): Family {
    const family = this.repository.findById(id);
    if (!family) throw new NotFoundException(`Famille ${id} introuvable`);
    return family;
  }

  addMember(familyId: string, dto: { email: string; role: string }): Member {
    // getFamily lève déjà NotFoundException si absente — pas de duplication de la vérification.
    const family = this.getFamily(familyId);

    const dejaMembre = family.members.some((m) => m.email.toLowerCase() === dto.email.toLowerCase());
    if (dejaMembre) throw new ConflictException(`${dto.email} est déjà membre de cette famille`);

    if (family.members.length >= QUOTA_MEMBRES) {
      throw new BadRequestException(`Quota de ${QUOTA_MEMBRES} membres atteint`);
    }

    // addMember ne peut pas renvoyer undefined ici : getFamily a déjà prouvé que la famille existe.
    return this.repository.addMember(familyId, dto)!;
  }

  listMembers(familyId: string): Member[] {
    return this.getFamily(familyId).members;
  }
}
