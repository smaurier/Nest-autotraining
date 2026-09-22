// routine.repository.port.ts — PAGE BLANCHE. Le PORT (interface) que la couche application
// utilise pour parler au stockage — SANS jamais savoir COMMENT ni OÙ les données vivent.
// Zéro import NestJS ici non plus : un port est un contrat, pas une implémentation.
//
// Exports attendus :
//   interface Routine { id: string; name: string; familyId: string }
//   interface RoutineRepositoryPort {
//     findById(id: string): Routine | undefined
//     listCompletions(routineId: string): Date[]
//     addCompletion(routineId: string, date: Date): void
//   }
//   const ROUTINE_REPOSITORY: symbol  — le jeton d'injection NestJS pour ce port (une
//     interface n'existe pas à l'exécution ; NestJS a besoin d'un jeton concret pour
//     l'injection de dépendance — c'est la SEULE concession technique dans ce fichier).
export {};
