// streak.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
// Zéro import : c'est la preuve que ce fichier n'a besoin de rien d'autre que du langage.

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD, comparaison par jour calendaire
}

function veille(d: Date): Date {
  const v = new Date(d);
  v.setUTCDate(v.getUTCDate() - 1);
  return v;
}

export function calculerStreak(completions: Date[], today: Date): number {
  const jours = new Set(completions.map(toKey)); // dédoublonne automatiquement
  const todayKey = toKey(today);
  const hier = veille(today);

  let curseur: Date;
  if (jours.has(todayKey)) {
    curseur = today;
  } else if (jours.has(toKey(hier))) {
    curseur = hier;
  } else {
    return 0; // ni aujourd'hui ni hier : la streak est brisée
  }

  let streak = 0;
  while (jours.has(toKey(curseur))) {
    streak++;
    curseur = veille(curseur); // un trou dans la Set arrête la boucle ici, jamais sauté
  }
  return streak;
}
