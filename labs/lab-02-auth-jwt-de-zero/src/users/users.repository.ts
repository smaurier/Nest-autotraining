// users.repository.ts — PAGE BLANCHE. Stockage en mémoire, aucune règle métier ici.
// Export attendu : UsersRepository (classe injectable), avec au minimum :
//   findByEmail(email: string): StoredUser | undefined
//   create(user: { email: string; passwordHash: string }): StoredUser
// StoredUser a la forme { id: string; email: string; passwordHash: string }.
export {};
