import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberCard } from "@/components/members/MemberCard";
import type { Member } from "@/types";

const mockMember: Member = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  first_name: "Jean",
  last_name: "Dupont",
  gender: "male",
  birth_date: "1950-03-15",
  death_date: null,
  birth_place: "Paris",
  photo_url: null,
  bio: null,
  is_private: false,
  created_by: "user-uuid",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("MemberCard", () => {
  // ── Affichage de base ──────────────────────────────────────────
  it("affiche le nom complet du membre", () => {
    render(<MemberCard member={mockMember} />);
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
  });

  it("affiche les initiales si pas de photo", () => {
    render(<MemberCard member={mockMember} />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("affiche une image si photo_url est fournie", () => {
    render(<MemberCard member={{ ...mockMember, photo_url: "https://example.com/photo.jpg" }} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
    expect(img).toHaveAttribute("alt", "Jean Dupont");
  });

  it("affiche 'Date inconnue' si pas de birth_date", () => {
    render(<MemberCard member={{ ...mockMember, birth_date: null }} />);
    expect(screen.getByText("Date inconnue")).toBeInTheDocument();
  });

  it("affiche l'âge calculé si birth_date est présente", () => {
    render(<MemberCard member={mockMember} />);
    // Vérifie qu'un texte contenant "ans" est présent
    expect(screen.getByText(/ans/)).toBeInTheDocument();
  });

  it("affiche l'âge au décès (fixe) si death_date est présente", () => {
    // Naissance 1950, décès 2000 → 50 ans
    render(<MemberCard member={{ ...mockMember, birth_date: "1950-01-01", death_date: "2000-01-01" }} />);
    expect(screen.getByText(/50 ans/)).toBeInTheDocument();
  });

  it("n'affiche pas le badge Privé pour un membre public", () => {
    render(<MemberCard member={mockMember} />);
    expect(screen.queryByText("Privé")).not.toBeInTheDocument();
  });

  it("affiche le badge Privé pour un membre privé", () => {
    render(<MemberCard member={{ ...mockMember, is_private: true }} />);
    expect(screen.getByText("Privé")).toBeInTheDocument();
  });

  // ── Interactions ───────────────────────────────────────────────
  it("appelle onClick au clic", async () => {
    const handleClick = jest.fn();
    render(<MemberCard member={mockMember} onClick={handleClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("appelle onClick à la touche Entrée", async () => {
    const handleClick = jest.fn();
    render(<MemberCard member={mockMember} onClick={handleClick} />);
    screen.getByRole("button").focus();
    await userEvent.keyboard("{Enter}");
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("ne plante pas si onClick n'est pas fourni", () => {
    render(<MemberCard member={mockMember} />);
    expect(() => userEvent.click(screen.getByRole("button"))).not.toThrow();
  });

  // ── Accessibilité ──────────────────────────────────────────────
  it("a un aria-label accessible", () => {
    render(<MemberCard member={mockMember} />);
    expect(screen.getByRole("button", { name: /Fiche de Jean Dupont/i })).toBeInTheDocument();
  });

  it("est focusable (tabIndex=0)", () => {
    render(<MemberCard member={mockMember} />);
    expect(screen.getByRole("button")).toHaveAttribute("tabindex", "0");
  });
});
