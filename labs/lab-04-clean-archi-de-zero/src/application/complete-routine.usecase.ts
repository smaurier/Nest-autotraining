// complete-routine.usecase.ts — PAGE BLANCHE. LA COUCHE APPLICATION : orchestre le domaine
// (streak.ts) et le port (routine.repository.port.ts) — mais ne connaît JAMAIS une
// implémentation concrète du port (pas de "InMemory", pas de "Prisma" ici, juste le PORT).
//
// Export attendu : CompleteRoutineUseCase (classe @Injectable, constructeur qui injecte le
// port via @Inject(ROUTINE_REPOSITORY)), avec :
//
//   async execute(routineId: string, today: Date): Promise<{ routineId: string; streak: number }>
//     - NotFoundException si la routine n'existe pas (@nestjs/common — c'est le SEUL import
//       NestJS toléré dans ce fichier, pour la gestion d'erreur ; ce n'est PAS une violation
//       de Clean Architecture aussi stricte que possible, c'est une simplification pragmatique
//       assumée pour ce lab, voir README)
//     - idempotent : si la routine est déjà complétée AUJOURD'HUI, ne l'ajoute PAS une
//       deuxième fois (pas de doublon dans le stockage)
//     - sinon, ajoute la complétion du jour via le port
//     - calcule et renvoie la streak à jour via calculerStreak (la couche domain)
export {};
