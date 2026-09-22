// routine.repository.port.ts — SOLUTION DE RÉFÉRENCE. Ne l'ouvre pas avant ton GREEN.
export interface Routine {
  id: string;
  name: string;
  familyId: string;
}

export interface RoutineRepositoryPort {
  findById(id: string): Routine | undefined;
  listCompletions(routineId: string): Date[];
  addCompletion(routineId: string, date: Date): void;
}

// Une interface TS n'existe plus au runtime (effacée à la compilation) : NestJS ne peut PAS
// s'en servir comme jeton d'injection. Un Symbol, si.
export const ROUTINE_REPOSITORY = Symbol("ROUTINE_REPOSITORY");
