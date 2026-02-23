import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "@/components/forms/RegisterForm";

// ── Mock Supabase client ────────────────────────────────────────
const mockSignUp = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signUp: mockSignUp },
  }),
}));

beforeEach(() => {
  mockSignUp.mockReset();
});

// ── Helpers ─────────────────────────────────────────────────────
async function fillAndSubmit(
  fullName: string,
  email: string,
  password: string,
) {
  await userEvent.type(screen.getByPlaceholderText("Jean Dupont"), fullName);
  await userEvent.type(screen.getByPlaceholderText("vous@exemple.com"), email);
  await userEvent.type(screen.getByPlaceholderText("Min. 8 caractères"), password);
  await userEvent.click(screen.getByRole("button", { name: /Créer mon compte/i }));
}

describe("RegisterForm", () => {
  // ── Rendu initial ──────────────────────────────────────────────
  it("affiche les 3 champs du formulaire", () => {
    render(<RegisterForm />);
    expect(screen.getByPlaceholderText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("vous@exemple.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Min. 8 caractères")).toBeInTheDocument();
  });

  it("affiche le bouton de soumission", () => {
    render(<RegisterForm />);
    expect(screen.getByRole("button", { name: /Créer mon compte/i })).toBeInTheDocument();
  });

  it("affiche un lien vers la page de connexion", () => {
    render(<RegisterForm />);
    expect(screen.getByRole("link", { name: /Se connecter/i })).toHaveAttribute("href", "/login");
  });

  // ── Validation ─────────────────────────────────────────────────
  it("affiche une erreur si le nom est trop court", async () => {
    render(<RegisterForm />);
    await fillAndSubmit("A", "jean@test.com", "motdepasse123");
    await waitFor(() => {
      expect(screen.getByText(/min\. 2 caractères/i)).toBeInTheDocument();
    });
  });

  it("affiche une erreur si l'email est vide", async () => {
    render(<RegisterForm />);
    // On remplit nom + mdp mais pas l'email → Zod rejette l'email vide
    await userEvent.type(screen.getByPlaceholderText("Jean Dupont"), "Jean Dupont");
    await userEvent.type(screen.getByPlaceholderText("Min. 8 caractères"), "motdepasse123");
    await userEvent.click(screen.getByRole("button", { name: /Créer mon compte/i }));
    await waitFor(() => {
      expect(screen.getByText(/email invalide/i)).toBeInTheDocument();
    });
  });

  it("affiche une erreur si le mot de passe est trop court", async () => {
    render(<RegisterForm />);
    await fillAndSubmit("Jean Dupont", "jean@test.com", "court");
    await waitFor(() => {
      expect(screen.getByText(/trop court/i)).toBeInTheDocument();
    });
  });

  it("ne soumet pas si les champs sont vides", async () => {
    render(<RegisterForm />);
    await userEvent.click(screen.getByRole("button", { name: /Créer mon compte/i }));
    await waitFor(() => {
      expect(mockSignUp).not.toHaveBeenCalled();
    });
  });

  // ── Succès ─────────────────────────────────────────────────────
  it("affiche le modal de confirmation email après une inscription réussie", async () => {
    mockSignUp.mockResolvedValueOnce({ data: { user: {} }, error: null });
    render(<RegisterForm />);
    await fillAndSubmit("Jean Dupont", "jean@test.com", "motdepasse123");
    await waitFor(() => {
      expect(screen.getByText(/vérifiez vos mails/i)).toBeInTheDocument();
    });
  });

  it("le modal de succès contient un lien vers /login", async () => {
    mockSignUp.mockResolvedValueOnce({ data: { user: {} }, error: null });
    render(<RegisterForm />);
    await fillAndSubmit("Jean Dupont", "jean@test.com", "motdepasse123");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Aller à la connexion/i })).toHaveAttribute("href", "/login");
    });
  });

  // ── Erreur serveur ─────────────────────────────────────────────
  it("affiche l'erreur serveur si Supabase retourne une erreur", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: null,
      error: { message: "Email déjà utilisé" },
    });
    render(<RegisterForm />);
    await fillAndSubmit("Jean Dupont", "jean@test.com", "motdepasse123");
    await waitFor(() => {
      expect(screen.getByText("Email déjà utilisé")).toBeInTheDocument();
    });
  });
});
