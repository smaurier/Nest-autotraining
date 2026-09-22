// families.repository.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

export interface Member {
  id: string;
  email: string;
  role: string;
}

export interface Family {
  id: string;
  name: string;
  members: Member[];
}

@Injectable()
export class FamiliesRepository {
  private readonly familles = new Map<string, Family>();

  create(name: string): Family {
    const family: Family = { id: randomUUID(), name, members: [] };
    this.familles.set(family.id, family);
    return family;
  }

  findById(id: string): Family | undefined {
    return this.familles.get(id);
  }

  addMember(familyId: string, member: { email: string; role: string }): Member | undefined {
    const family = this.familles.get(familyId);
    if (!family) return undefined;
    const created: Member = { id: randomUUID(), ...member };
    family.members.push(created);
    return created;
  }
}
