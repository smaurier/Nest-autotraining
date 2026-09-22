// auth.module.ts — PAGE BLANCHE. Assemble tout, y compris JwtModule.register({...}).
// Export attendu : AuthModule. Configure JwtModule avec un secret (n'importe quelle chaîne :
// l'oracle ne connaît jamais ton secret, il teste le vrai aller-retour login → /auth/me avec
// le token reçu, comme un vrai client) et une expiration de "1h".
export {};
