// in-memory-routine.repository.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { Injectable } from "@nestjs/common";
import type { Routine, RoutineRepositoryPort } from "../domain/routine.repository.port";

@Injectable()
export class InMemoryRoutineRepository implements RoutineRepositoryPort {
  private readonly routines = new Map<string, Routine>([
    ["brossage", { id: "brossage", name: "Brossage de dents", familyId: "f1" }],
  ]);
  private readonly completions = new Map<string, Date[]>();

  findById(id: string): Routine | undefined {
    return this.routines.get(id);
  }

  listCompletions(routineId: string): Date[] {
    return this.completions.get(routineId) ?? [];
  }

  addCompletion(routineId: string, date: Date): void {
    const existantes = this.completions.get(routineId) ?? [];
    this.completions.set(routineId, [...existantes, date]);
  }
}
