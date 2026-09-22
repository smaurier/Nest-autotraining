// complete-routine.usecase.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ROUTINE_REPOSITORY, type RoutineRepositoryPort } from "../domain/routine.repository.port";
import { calculerStreak } from "../domain/streak";

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class CompleteRoutineUseCase {
  // Injecté par JETON (le port), jamais par une classe concrète : l'application ne sait
  // pas — et n'a pas besoin de savoir — si le stockage est en mémoire, SQL, ou autre.
  constructor(@Inject(ROUTINE_REPOSITORY) private readonly repository: RoutineRepositoryPort) {}

  async execute(routineId: string, today: Date): Promise<{ routineId: string; streak: number }> {
    const routine = this.repository.findById(routineId);
    if (!routine) throw new NotFoundException(`Routine ${routineId} introuvable`);

    const completions = this.repository.listCompletions(routineId);
    const dejaFaitAujourdhui = completions.some((c) => toKey(c) === toKey(today));
    if (!dejaFaitAujourdhui) {
      this.repository.addCompletion(routineId, today);
    }

    // Recalcule sur l'état à jour (avec ou sans le nouvel ajout selon l'idempotence ci-dessus).
    const toutesLesCompletions = dejaFaitAujourdhui ? completions : [...completions, today];
    const streak = calculerStreak(toutesLesCompletions, today);
    return { routineId, streak };
  }
}
