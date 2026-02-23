import { inputCls } from "@/lib/ui";

describe("inputCls (shared styles)", () => {
  it("est une chaîne non vide", () => {
    expect(typeof inputCls).toBe("string");
    expect(inputCls.length).toBeGreaterThan(0);
  });

  it("contient la classe w-full", () => {
    expect(inputCls).toContain("w-full");
  });

  it("contient les classes de bordure", () => {
    expect(inputCls).toContain("border");
    expect(inputCls).toContain("rounded-lg");
  });

  it("contient les classes de padding", () => {
    expect(inputCls).toContain("px-3");
    expect(inputCls).toContain("py-2");
  });

  it("contient les classes de focus", () => {
    expect(inputCls).toContain("focus:outline-none");
    expect(inputCls).toContain("focus:ring-2");
  });

  it("contient la taille de texte sm", () => {
    expect(inputCls).toContain("text-sm");
  });
});
