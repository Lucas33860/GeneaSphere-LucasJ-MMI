import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(" ");
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function calculateAge(
  birthDate: string | null,
  deathDate?: string | null
): number | null {
  if (!birthDate) return null;
  const end = deathDate ? new Date(deathDate) : new Date();
  const birth = new Date(birthDate);
  const age = end.getFullYear() - birth.getFullYear();
  const monthDiff = end.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && end.getDate() < birth.getDate())) {
    return age - 1;
  }
  return age;
}
