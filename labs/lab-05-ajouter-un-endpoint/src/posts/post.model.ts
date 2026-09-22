// post.model.ts — L'EXISTANT, en production. C'est LE CONTRAT que le front consomme
// aujourd'hui — un front réel dépend de cette forme exacte. Ne pas modifier.
export interface Post {
  id: string;
  familyId: string;
  authorId: string;
  content: string;
  createdAt: string; // ISO 8601
}
