import { stateToBody, unionToState4, UNION_STATE_OPTIONS } from "@/lib/union";
import type { UnionState4 } from "@/lib/union";

// ── stateToBody ───────────────────────────────────────────────────
describe("stateToBody", () => {
  const date = "2020-06-15";

  it("couple avec date → union_type=couple, union_date renseignée, pas de separation_date", () => {
    const body = stateToBody("couple", date);
    expect(body.union_type).toBe("couple");
    expect(body.union_date).toBe(date);
    expect(body.separation_date).toBeNull();
  });

  it("couple sans date → union_date null", () => {
    const body = stateToBody("couple", "");
    expect(body.union_type).toBe("couple");
    expect(body.union_date).toBeNull();
    expect(body.separation_date).toBeNull();
  });

  it("marriage avec date → union_type=marriage, union_date renseignée", () => {
    const body = stateToBody("marriage", date);
    expect(body.union_type).toBe("marriage");
    expect(body.union_date).toBe(date);
    expect(body.separation_date).toBeNull();
  });

  it("ex-couple avec date → union_type=couple, separation_date renseignée, union_date null", () => {
    const body = stateToBody("ex-couple", date);
    expect(body.union_type).toBe("couple");
    expect(body.union_date).toBeNull();
    expect(body.separation_date).toBe(date);
  });

  it("divorce avec date → union_type=marriage, separation_date renseignée", () => {
    const body = stateToBody("divorce", date);
    expect(body.union_type).toBe("marriage");
    expect(body.union_date).toBeNull();
    expect(body.separation_date).toBe(date);
  });

  it("ex-couple sans date → separation_date est la date du jour (non vide)", () => {
    const body = stateToBody("ex-couple", "");
    expect(body.separation_date).toBeTruthy();
    expect(body.separation_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("divorce sans date → separation_date est la date du jour", () => {
    const body = stateToBody("divorce", "");
    expect(body.separation_date).toBeTruthy();
    expect(body.separation_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("les états séparés n'ont jamais de union_date", () => {
    for (const state of ["ex-couple", "divorce"] as UnionState4[]) {
      const body = stateToBody(state, date);
      expect(body.union_date).toBeNull();
    }
  });

  it("les états non-séparés n'ont jamais de separation_date", () => {
    for (const state of ["couple", "marriage"] as UnionState4[]) {
      const body = stateToBody(state, date);
      expect(body.separation_date).toBeNull();
    }
  });
});

// ── unionToState4 ─────────────────────────────────────────────────
describe("unionToState4", () => {
  it("couple actif → 'couple'", () => {
    expect(unionToState4({ union_type: "couple", separation_date: null })).toBe("couple");
  });

  it("couple séparé → 'ex-couple'", () => {
    expect(unionToState4({ union_type: "couple", separation_date: "2020-01-01" })).toBe("ex-couple");
  });

  it("mariage actif → 'marriage'", () => {
    expect(unionToState4({ union_type: "marriage", separation_date: null })).toBe("marriage");
  });

  it("mariage séparé → 'divorce'", () => {
    expect(unionToState4({ union_type: "marriage", separation_date: "2010-06-01" })).toBe("divorce");
  });

  it("aller-retour stateToBody → unionToState4 pour couple", () => {
    const body = stateToBody("couple", "2020-01-01");
    expect(unionToState4(body)).toBe("couple");
  });

  it("aller-retour stateToBody → unionToState4 pour ex-couple", () => {
    const body = stateToBody("ex-couple", "2022-03-10");
    expect(unionToState4(body)).toBe("ex-couple");
  });

  it("aller-retour stateToBody → unionToState4 pour marriage", () => {
    const body = stateToBody("marriage", "2000-06-15");
    expect(unionToState4(body)).toBe("marriage");
  });

  it("aller-retour stateToBody → unionToState4 pour divorce", () => {
    const body = stateToBody("divorce", "2015-09-20");
    expect(unionToState4(body)).toBe("divorce");
  });
});

// ── UNION_STATE_OPTIONS ───────────────────────────────────────────
describe("UNION_STATE_OPTIONS", () => {
  const values = UNION_STATE_OPTIONS.map(o => o.value);

  it("contient exactement 4 options", () => {
    expect(UNION_STATE_OPTIONS).toHaveLength(4);
  });

  it("contient les 4 états attendus", () => {
    expect(values).toContain("couple");
    expect(values).toContain("ex-couple");
    expect(values).toContain("marriage");
    expect(values).toContain("divorce");
  });

  it("chaque option a un picto non vide", () => {
    UNION_STATE_OPTIONS.forEach(o => {
      expect(o.picto.length).toBeGreaterThan(0);
    });
  });

  it("chaque option a un label non vide", () => {
    UNION_STATE_OPTIONS.forEach(o => {
      expect(o.label.length).toBeGreaterThan(0);
    });
  });

  it("chaque option a une classe CSS active", () => {
    UNION_STATE_OPTIONS.forEach(o => {
      expect(o.active.length).toBeGreaterThan(0);
    });
  });

  it("les valeurs sont uniques", () => {
    expect(new Set(values).size).toBe(UNION_STATE_OPTIONS.length);
  });
});
