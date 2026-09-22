// streak.spec.ts — TEST DE FRONTIÈRE n°1 : le domaine. AUCUN import NestJS ici — si ce fichier
// avait besoin de @nestjs/testing pour tourner, ce serait la preuve que ton domaine dépend du
// framework, ce qui casserait Clean Architecture. Ne pas modifier.
import { calculerStreak } from "../src/domain/streak";

const jour = (offsetDepuisAujourdhui: number, today: Date): Date => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + offsetDepuisAujourdhui);
  return d;
};

const AUJOURDHUI = new Date("2026-09-23T00:00:00.000Z");

describe("calculerStreak — pure, zéro dépendance", () => {
  it("aucune complétion → 0", () => {
    expect(calculerStreak([], AUJOURDHUI)).toBe(0);
  });

  it("complété aujourd'hui seulement → 1", () => {
    expect(calculerStreak([jour(0, AUJOURDHUI)], AUJOURDHUI)).toBe(1);
  });

  it("complété aujourd'hui, hier, avant-hier → 3", () => {
    expect(calculerStreak([jour(0, AUJOURDHUI), jour(-1, AUJOURDHUI), jour(-2, AUJOURDHUI)], AUJOURDHUI)).toBe(3);
  });

  it("complété hier et avant-hier, PAS encore aujourd'hui → 2 (streak encore vivante)", () => {
    expect(calculerStreak([jour(-1, AUJOURDHUI), jour(-2, AUJOURDHUI)], AUJOURDHUI)).toBe(2);
  });

  it("dernière complétion il y a 3 jours (ni aujourd'hui ni hier) → 0 (streak brisée)", () => {
    expect(calculerStreak([jour(-3, AUJOURDHUI)], AUJOURDHUI)).toBe(0);
  });

  it("un TROU au milieu arrête le décompte à cet endroit, ne le saute pas", () => {
    // aujourd'hui, hier présents ; avant-hier ABSENT ; il y a 3 jours présent (ignoré, trou avant)
    const completions = [jour(0, AUJOURDHUI), jour(-1, AUJOURDHUI), jour(-3, AUJOURDHUI)];
    expect(calculerStreak(completions, AUJOURDHUI)).toBe(2);
  });

  it("les doublons le même jour ne comptent qu'une fois", () => {
    const memeJourDeuxFois = [jour(0, AUJOURDHUI), new Date(jour(0, AUJOURDHUI).getTime() + 3600_000)];
    expect(calculerStreak(memeJourDeuxFois, AUJOURDHUI)).toBe(1);
  });
});
