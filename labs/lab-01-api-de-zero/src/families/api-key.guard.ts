// api-key.guard.ts — PAGE BLANCHE. Un Guard NestJS qui protège l'ajout de membre.
// Export attendu : ApiKeyGuard (implémente CanActivate). Lit l'en-tête `x-api-key` de la
// requête et compare à la constante API_KEY exportée par ce même fichier (valeur : "dev-key").
// Absent ou faux → refuse (l'oracle attend un statut 403, pas une exception non gérée).
export {};
