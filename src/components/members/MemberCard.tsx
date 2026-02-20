import { type Member } from "@/types";

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function calculateAge(birthDate: string | null, deathDate?: string | null): number | null {
  if (!birthDate) return null;
  const end = deathDate ? new Date(deathDate) : new Date();
  const birth = new Date(birthDate);
  const age = end.getFullYear() - birth.getFullYear();
  const m = end.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) return age - 1;
  return age;
}

interface MemberCardProps {
  member: Member;
  onClick?: () => void;
}

export function MemberCard({ member, onClick }: MemberCardProps) {
  const age = calculateAge(member.birth_date, member.death_date);
  const fullName = `${member.first_name} ${member.last_name}`;

  return (
    <div
      className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      aria-label={`Fiche de ${fullName}`}
    >
      <div className="flex items-center gap-3">
        {member.photo_url ? (
          <img
            src={member.photo_url}
            alt={fullName}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg">
            {member.first_name[0]}{member.last_name[0]}
          </div>
        )}
        <div>
          <h3 className="font-semibold text-gray-900">{fullName}</h3>
          <p className="text-sm text-gray-500">
            {member.birth_date ? formatDate(member.birth_date) : "Date inconnue"}
            {age !== null && ` · ${age} ans`}
          </p>
        </div>
      </div>
      {member.is_private && (
        <span className="mt-2 inline-block text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
          Privé
        </span>
      )}
    </div>
  );
}
