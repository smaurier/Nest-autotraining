// families.repository.ts — PAGE BLANCHE. Le stockage, en mémoire (une Map suffit).
// Export attendu : FamiliesRepository (classe injectable), avec au minimum :
//   create(name: string): Family
//   findById(id: string): Family | undefined
//   addMember(familyId: string, member: { email: string; role: string }): Member | undefined
// Le type Family a { id, name, members: Member[] } ; Member a { id, email, role }.
// N'exporte PAS de logique métier ici (pas de vérif de doublon, pas de quota) — juste du
// stockage. La règle métier vit dans le service (couche suivante).
export {};
