import { canWrite, canDelete, canShare, getUserTreeRole } from "@/lib/tree-access";
import type { TreeRole } from "@/lib/tree-access";

// ── canWrite ──────────────────────────────────────────────────────
describe("canWrite", () => {
  it("autorise owner", () => expect(canWrite("owner")).toBe(true));
  it("autorise admin", () => expect(canWrite("admin")).toBe(true));
  it("autorise editor", () => expect(canWrite("editor")).toBe(true));
  it("refuse reader", () => expect(canWrite("reader")).toBe(false));
  it("refuse null", () => expect(canWrite(null)).toBe(false));
});

// ── canDelete ─────────────────────────────────────────────────────
describe("canDelete", () => {
  it("autorise owner", () => expect(canDelete("owner")).toBe(true));
  it("autorise admin", () => expect(canDelete("admin")).toBe(true));
  it("refuse editor", () => expect(canDelete("editor")).toBe(false));
  it("refuse reader", () => expect(canDelete("reader")).toBe(false));
  it("refuse null", () => expect(canDelete(null)).toBe(false));
});

// ── canShare ──────────────────────────────────────────────────────
describe("canShare", () => {
  it("autorise owner", () => expect(canShare("owner")).toBe(true));
  it("autorise admin", () => expect(canShare("admin")).toBe(true));
  it("refuse editor", () => expect(canShare("editor")).toBe(false));
  it("refuse reader", () => expect(canShare("reader")).toBe(false));
  it("refuse null", () => expect(canShare(null)).toBe(false));
});

// ── cohérence des rôles ───────────────────────────────────────────
describe("hiérarchie des rôles", () => {
  const roles: (TreeRole | null)[] = ["owner", "admin", "editor", "reader", null];

  it("canWrite ⊇ canDelete ⊇ canShare", () => {
    for (const r of roles) {
      if (canShare(r))  expect(canDelete(r)).toBe(true);   // share ⊆ delete
      if (canDelete(r)) expect(canWrite(r)).toBe(true);    // delete ⊆ write
    }
  });

  it("seul owner et admin peuvent supprimer", () => {
    expect(canDelete("owner")).toBe(true);
    expect(canDelete("admin")).toBe(true);
    expect(canDelete("editor")).toBe(false);
    expect(canDelete("reader")).toBe(false);
  });

  it("editor peut écrire mais pas supprimer ni partager", () => {
    expect(canWrite("editor")).toBe(true);
    expect(canDelete("editor")).toBe(false);
    expect(canShare("editor")).toBe(false);
  });

  it("reader ne peut rien modifier", () => {
    expect(canWrite("reader")).toBe(false);
    expect(canDelete("reader")).toBe(false);
    expect(canShare("reader")).toBe(false);
  });
});

// ── getUserTreeRole ───────────────────────────────────────────────
describe("getUserTreeRole", () => {
  const makeMockSupabase = (treeOwner: string | null, accessRole: string | null) => {
    const treesQuery = {
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: treeOwner ? { owner_id: treeOwner } : null,
      }),
    };
    const accessQuery = {
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: accessRole ? { role: accessRole } : null,
      }),
    };
    return {
      from: jest.fn((table: string) => {
        if (table === "trees") return { select: jest.fn().mockReturnValue(treesQuery) };
        return { select: jest.fn().mockReturnValue(accessQuery) };
      }),
    };
  };

  it("retourne null si l'arbre n'existe pas", async () => {
    const supabase = makeMockSupabase(null, null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = await getUserTreeRole(supabase as any, "tree-1", "user-1");
    expect(role).toBeNull();
  });

  it("retourne 'owner' si l'utilisateur est propriétaire", async () => {
    const supabase = makeMockSupabase("user-1", null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = await getUserTreeRole(supabase as any, "tree-1", "user-1");
    expect(role).toBe("owner");
  });

  it("retourne le rôle tree_access si l'utilisateur a un accès partagé", async () => {
    const supabase = makeMockSupabase("user-2", "editor");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = await getUserTreeRole(supabase as any, "tree-1", "user-1");
    expect(role).toBe("editor");
  });

  it("retourne null si aucun accès trouvé", async () => {
    const supabase = makeMockSupabase("user-2", null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = await getUserTreeRole(supabase as any, "tree-1", "user-1");
    expect(role).toBeNull();
  });

  it("retourne 'admin' pour un accès admin partagé", async () => {
    const supabase = makeMockSupabase("user-owner", "admin");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = await getUserTreeRole(supabase as any, "tree-1", "user-shared");
    expect(role).toBe("admin");
  });

  it("retourne 'reader' pour un accès lecteur", async () => {
    const supabase = makeMockSupabase("user-owner", "reader");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = await getUserTreeRole(supabase as any, "tree-1", "user-shared");
    expect(role).toBe("reader");
  });
});
