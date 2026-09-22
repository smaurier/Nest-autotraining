// password.service.ts — PAGE BLANCHE. Encapsule bcryptjs — le RESTE du code ne connaît
// jamais bcryptjs directement, seulement ce service (si on doit changer d'algo un jour,
// un seul fichier bouge).
// Export attendu : PasswordService (classe injectable), avec :
//   hash(password: string): Promise<string>
//   compare(password: string, hash: string): Promise<boolean>
export {};
