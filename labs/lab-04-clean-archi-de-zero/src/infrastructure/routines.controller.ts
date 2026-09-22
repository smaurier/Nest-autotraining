// routines.controller.ts — PAGE BLANCHE. LA COUCHE INFRASTRUCTURE (HTTP) : traduit une
// requête HTTP en appel au use case, et le résultat du use case en réponse HTTP. Ne
// réimplémente AUCUNE règle métier ici.
//
// Export attendu : RoutinesController, avec :
//   POST /routines/:id/complete
//     - body : CompleteRoutineDto { today: string }  (format "YYYY-MM-DD", @IsDateString)
//     - délègue à CompleteRoutineUseCase.execute(id, new Date(dto.today + "T00:00:00.000Z"))
//     - 200, renvoie { routineId, streak }
export {};
