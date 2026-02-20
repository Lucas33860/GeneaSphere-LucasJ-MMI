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
  it("affiche le nom complet du membre", () => {
    render(<MemberCard member={mockMember} />);
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
  });

  it("affiche les initiales si pas de photo", () => {
    render(<MemberCard member={mockMember} />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("n'affiche pas le badge Privé pour un membre public", () => {
    render(<MemberCard member={mockMember} />);
    expect(screen.queryByText("Privé")).not.toBeInTheDocument();
  });

  it("affiche le badge Privé pour un membre privé", () => {
    render(<MemberCard member={{ ...mockMember, is_private: true }} />);
    expect(screen.getByText("Privé")).toBeInTheDocument();
  });

  it("appelle onClick au clic", async () => {
    const handleClick = jest.fn();
    render(<MemberCard member={mockMember} onClick={handleClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("a un aria-label accessible", () => {
    render(<MemberCard member={mockMember} />);
    expect(screen.getByRole("button", { name: /Fiche de Jean Dupont/i })).toBeInTheDocument();
  });
});
