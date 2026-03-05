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

const GENDER_STRIPE: Record<string, string> = {
  male:   "bg-gradient-to-r from-blue-500 to-blue-400",
  female: "bg-gradient-to-r from-pink-500 to-rose-400",
  other:  "bg-gradient-to-r from-violet-500 to-purple-400",
};
const GENDER_AVATAR: Record<string, string> = {
  male:   "from-blue-500 to-blue-400",
  female: "from-pink-500 to-rose-400",
  other:  "from-violet-500 to-purple-400",
};

interface MemberCardProps {
  member: Member;
  onClick?: () => void;
}

export function MemberCard({ member, onClick }: MemberCardProps) {
  const age = calculateAge(member.birth_date, member.death_date);
  const fullName = `${member.first_name} ${member.last_name}`;
  const gender = member.gender ?? "";
  const stripe = GENDER_STRIPE[gender] ?? "bg-gradient-to-r from-indigo-500 to-violet-400";
  const avatarGrad = GENDER_AVATAR[gender] ?? "from-indigo-500 to-violet-400";
  const isDeceased = !!member.death_date;

  return (
    <div
      className="bg-white rounded-2xl shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer overflow-hidden border border-zinc-100 group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      aria-label={`Fiche de ${fullName}`}
    >
      {/* Stripe genre */}
      <div className={`h-1.5 w-full ${stripe}`} />

      <div className="p-4 flex items-center gap-3">
        {/* Avatar */}
        {member.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.photo_url}
            alt={fullName}
            className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-white shadow-md"
          />
        ) : (
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white font-bold text-base shrink-0 shadow-md`}>
            {member.first_name[0]}{member.last_name[0]}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-zinc-900 truncate group-hover:text-indigo-700 transition-colors">{fullName}</h3>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">
            {member.birth_date ? formatDate(member.birth_date) : "Date inconnue"}
            {age !== null && ` · ${age} ans`}
          </p>
        </div>

        {/* Badges */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isDeceased && (
            <span className="text-xs bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full font-medium">Décédé</span>
          )}
          {member.is_private && (
            <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Privé</span>
          )}
        </div>
      </div>
    </div>
  );
}
