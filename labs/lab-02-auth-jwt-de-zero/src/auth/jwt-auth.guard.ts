// jwt-auth.guard.ts — PAGE BLANCHE. Un Guard qui vérifie un Bearer token, SANS Passport
// (juste JwtService, directement — c'est un pattern NestJS valide et plus simple à tracer).
// Export attendu : JwtAuthGuard (implémente CanActivate, injecte JwtService dans son
// constructeur). Comportement :
//   - lit l'en-tête Authorization, format "Bearer <token>" ; absent/malformé → renvoie false
//   - vérifie le token avec jwtService.verify(token) (synchrone, jwtService.verify lève si
//     invalide/expiré — attrape l'erreur, renvoie false, ne laisse RIEN remonter)
//   - si valide, POSE `request.user = payload` puis renvoie true (le controller lira
//     `request.user` via un décorateur @Req() — pas de décorateur custom dans ce lab)
export {};
