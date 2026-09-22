// routines.module.ts — PAGE BLANCHE. Assemble tout, y compris le branchement du PORT vers
// SON implémentation concrète : { provide: ROUTINE_REPOSITORY, useClass: InMemoryRoutineRepository }.
// C'est LA ligne qui matérialise l'inversion de dépendance — partout ailleurs dans le code,
// seul le jeton ROUTINE_REPOSITORY (le port) est connu, jamais InMemoryRoutineRepository.
// Export attendu : RoutinesModule.
export {};
