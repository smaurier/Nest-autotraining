// families.controller.ts — PAGE BLANCHE. Les routes HTTP, fines : elles délèguent tout au
// service injecté, ne réimplémentent aucune règle métier.
// Export attendu : FamiliesController, avec :
//   POST   /families                → body CreateFamilyDto → 201, la famille créée
//   POST   /families/:id/members    → body AddMemberDto, protégée par ApiKeyGuard → 201, le membre créé
//   GET    /families/:id/members    → 200, la liste des membres
export {};
