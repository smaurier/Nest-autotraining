// streak.ts — PAGE BLANCHE. LE CŒUR DU DOMAINE. Zéro import NestJS, zéro import de quoi que
// ce soit d'externe (juste du TypeScript pur) — c'est LA règle de la couche domain en Clean
// Architecture : elle ne dépend de rien, tout le reste dépend d'elle.
//
// Export attendu : calculerStreak(completions: Date[], today: Date): number
//
// Règle : une "streak" est le nombre de jours CONSÉCUTIFS se terminant aujourd'hui OU hier
// (si aujourd'hui n'est pas encore fait, la streak reste "vivante" jusqu'à la fin de la
// journée — elle ne casse qu'après un jour complètement sauté).
//   - Si ni aujourd'hui ni hier ne sont dans `completions` → 0 (streak brisée).
//   - Sinon, compte en remontant jour par jour tant que chaque jour est présent ; un TROU
//     (un jour manquant au milieu) arrête le compte à cet endroit — n'ignore jamais un trou.
//   - Les doublons (deux complétions le même jour) comptent pour un seul jour.
//   - Compare par JOUR CALENDAIRE (UTC), jamais par égalité d'instant Date exact.
export {};
