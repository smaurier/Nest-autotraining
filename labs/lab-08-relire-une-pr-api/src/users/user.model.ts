// user.model.ts — L'EXISTANT. Ne pas modifier.
export interface User {
  id: string;
  email: string;
  passwordHash: string; // ne doit JAMAIS quitter le backend
  name: string;
  bio: string;
  role: "member" | "admin";
}
