import { memberSchema } from "@/lib/schemas/member";

describe("memberSchema (validation Zod)", () => {
  // ── Cas valides ────────────────────────────────────────────────
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

  it("accepte tous les genres valides", () => {
    for (const gender of ["male", "female", "other"]) {
      const result = memberSchema.safeParse({ first_name: "A", last_name: "B", gender });
      expect(result.success).toBe(true);
    }
  });

  it("accepte null pour les champs optionnels", () => {
    const result = memberSchema.safeParse({
      first_name: "Jean",
      last_name: "Dupont",
      gender: null,
      birth_date: null,
      death_date: null,
      birth_place: null,
      bio: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepte une birth_date et une death_date valides", () => {
    const result = memberSchema.safeParse({
      first_name: "Jean",
      last_name: "Dupont",
      birth_date: "1900-01-01",
      death_date: "1980-12-31",
    });
    expect(result.success).toBe(true);
  });

  it("applique is_private=false par défaut", () => {
    const result = memberSchema.safeParse({ first_name: "Jean", last_name: "Dupont" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.is_private).toBe(false);
  });

  // ── Champs requis ──────────────────────────────────────────────
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

  // ── Limites de longueur ────────────────────────────────────────
  it("échoue si le prénom dépasse 100 caractères", () => {
    const result = memberSchema.safeParse({
      first_name: "A".repeat(101),
      last_name: "Dupont",
    });
    expect(result.success).toBe(false);
  });

  it("échoue si le nom dépasse 100 caractères", () => {
    const result = memberSchema.safeParse({
      first_name: "Jean",
      last_name: "B".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("échoue si bio dépasse 5000 caractères", () => {
    const result = memberSchema.safeParse({
      first_name: "Jean",
      last_name: "Dupont",
      bio: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("échoue si birth_place dépasse 200 caractères", () => {
    const result = memberSchema.safeParse({
      first_name: "Jean",
      last_name: "Dupont",
      birth_place: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  // ── Format des données ────────────────────────────────────────
  it("échoue si le genre est invalide", () => {
    const result = memberSchema.safeParse({
      first_name: "Jean",
      last_name: "Dupont",
      gender: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("échoue si birth_date est au mauvais format", () => {
    const result = memberSchema.safeParse({
      first_name: "Jean",
      last_name: "Dupont",
      birth_date: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("échoue si death_date est au mauvais format", () => {
    const result = memberSchema.safeParse({
      first_name: "Jean",
      last_name: "Dupont",
      death_date: "32/13/2000",
    });
    expect(result.success).toBe(false);
  });
});
