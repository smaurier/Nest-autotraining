// complete-routine.usecase.spec.ts — TEST DE FRONTIÈRE n°2 : la couche application, avec un
// FAUX port (ni InMemory, ni aucune implémentation réelle — juste un objet qui respecte
// l'interface). Preuve que l'application ne dépend QUE du port, jamais d'un adaptateur
// concret. Ne pas modifier.
import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { CompleteRoutineUseCase } from "../src/application/complete-routine.usecase";
import { ROUTINE_REPOSITORY, type Routine, type RoutineRepositoryPort } from "../src/domain/routine.repository.port";

class FakeRoutineRepository implements RoutineRepositoryPort {
  private routine: Routine | undefined = { id: "brossage", name: "Brossage", familyId: "f1" };
  private completions: Date[] = [];

  findById(id: string) {
    return id === this.routine?.id ? this.routine : undefined;
  }
  listCompletions() {
    return this.completions;
  }
  addCompletion(_routineId: string, date: Date) {
    this.completions.push(date);
  }
  // Aides de test, pas du port :
  setCompletions(dates: Date[]) {
    this.completions = dates;
  }
  setRoutine(r: Routine | undefined) {
    this.routine = r;
  }
}

describe("CompleteRoutineUseCase", () => {
  let useCase: CompleteRoutineUseCase;
  let repo: FakeRoutineRepository;

  beforeEach(async () => {
    repo = new FakeRoutineRepository();
    const module = await Test.createTestingModule({
      providers: [CompleteRoutineUseCase, { provide: ROUTINE_REPOSITORY, useValue: repo }],
    }).compile();
    useCase = module.get(CompleteRoutineUseCase);
  });

  it("NotFoundException si la routine n'existe pas", async () => {
    repo.setRoutine(undefined);
    await expect(useCase.execute("zzz", new Date("2026-09-23"))).rejects.toThrow(NotFoundException);
  });

  it("ajoute la complétion du jour et renvoie la streak", async () => {
    const today = new Date("2026-09-23T00:00:00.000Z");
    const result = await useCase.execute("brossage", today);
    expect(result).toEqual({ routineId: "brossage", streak: 1 });
    expect(repo.listCompletions()).toHaveLength(1);
  });

  it("idempotent : compléter deux fois le même jour n'ajoute pas de doublon", async () => {
    const today = new Date("2026-09-23T00:00:00.000Z");
    await useCase.execute("brossage", today);
    const result = await useCase.execute("brossage", today);
    expect(result).toEqual({ routineId: "brossage", streak: 1 });
    expect(repo.listCompletions()).toHaveLength(1);
  });

  it("la streak reflète l'historique déjà présent, pas seulement l'ajout du jour", async () => {
    const today = new Date("2026-09-23T00:00:00.000Z");
    const hier = new Date("2026-09-22T00:00:00.000Z");
    repo.setCompletions([hier]);
    const result = await useCase.execute("brossage", today);
    expect(result.streak).toBe(2);
  });
});
