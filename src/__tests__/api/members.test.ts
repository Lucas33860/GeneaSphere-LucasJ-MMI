import { memberSchema } from "@/lib/schemas/member";

describe("memberSchema (validation Zod)", () => {
  it("valide un membre complet", () => {
    const result = memberSchema.safeParse({
      first_name: "Jean",
      last_name: "Dupont",
      gender: "male",
      birth_date: "1950-03-15",
      death_date: null,
      birth_place: "Paris",
      bio: "Description",
      is_private: false,
    });
    expect(result.success).toBe(true);
  });

  it("valide un membre minimal (prénom + nom)", () => {
    const result = memberSchema.safeParse({
      first_name: "Marie",
      last_name: "Curie",
    });
    expect(result.success).toBe(true);
  });

  it("échoue si le prénom est vide", () => {
    const result = memberSchema.safeParse({ first_name: "", last_name: "Dupont" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("first_name");
    }
  });

  it("échoue si le nom est vide", () => {
    const result = memberSchema.safeParse({ first_name: "Jean", last_name: "" });
    expect(result.success).toBe(false);
  });

  it("échoue si le genre est invalide", () => {
    const result = memberSchema.safeParse({ first_name: "Jean", last_name: "Dupont", gender: "invalid" });
    expect(result.success).toBe(false);
  });

  it("échoue si la date de naissance est invalide", () => {
    const result = memberSchema.safeParse({ first_name: "Jean", last_name: "Dupont", birth_date: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("applique is_private=false par défaut", () => {
    const result = memberSchema.safeParse({ first_name: "Jean", last_name: "Dupont" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.is_private).toBe(false);
  });
});
