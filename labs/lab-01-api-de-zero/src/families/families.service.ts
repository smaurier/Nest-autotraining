// families.service.ts — PAGE BLANCHE. La logique métier, au-dessus du repository injecté.
// Export attendu : FamiliesService (classe injectable, constructeur qui reçoit
// FamiliesRepository), avec :
//   createFamily(name: string): Family
//   getFamily(id: string): Family  — lève NotFoundException si absente
//   addMember(familyId: string, dto: { email: string; role: string }): Member
//     - NotFoundException si la famille n'existe pas
//     - ConflictException si l'email est déjà membre de CETTE famille
//     - BadRequestException si la famille compte déjà 20 membres (quota)
//   listMembers(familyId: string): Member[] — lève NotFoundException si la famille n'existe pas
export {};
