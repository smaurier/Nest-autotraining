// auth.service.ts — PAGE BLANCHE. La logique métier de l'authentification.
// Export attendu : AuthService (constructeur : UsersRepository, PasswordService, JwtService), avec :
//   register(email: string, password: string): Promise<{ id: string; email: string }>
//     - ConflictException si l'email existe déjà (insensible à la casse)
//     - hash le mot de passe (jamais en clair, jamais dans la réponse)
//   login(email: string, password: string): Promise<{ accessToken: string }>
//     - UnauthorizedException si l'email est inconnu OU le mot de passe est faux — LE MÊME
//       message dans les deux cas (ne jamais révéler si un email existe, cf module sécurité)
//     - le token contient au moins { sub: <id>, email: <email> }
export {};
