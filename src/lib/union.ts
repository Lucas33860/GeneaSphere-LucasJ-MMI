export type UnionState4 = "couple" | "ex-couple" | "marriage" | "divorce";

export const UNION_STATE_OPTIONS: { value: UnionState4; picto: string; label: string; active: string }[] = [
  { value: "couple",    picto: "♥",   label: "Couple",    active: "bg-pink-500 border-pink-500 text-white" },
  { value: "ex-couple", picto: "💔",  label: "Ex-couple", active: "bg-slate-400 border-slate-400 text-white" },
  { value: "marriage",  picto: "💍",  label: "Marié·e",   active: "bg-amber-500 border-amber-500 text-white" },
  { value: "divorce",   picto: "💍✗", label: "Divorcé·e", active: "bg-slate-600 border-slate-600 text-white" },
];

export function stateToBody(state: UnionState4, date: string) {
  const isSep = state === "ex-couple" || state === "divorce";
  // Pour un état séparé sans date saisie : on stocke aujourd'hui
  // (un separation_date NULL serait indiscernable de "marié" côté DB)
  const fallbackDate = new Date().toISOString().slice(0, 10);
  return {
    union_type:      state === "couple" || state === "ex-couple" ? "couple" : "marriage",
    union_date:      !isSep ? (date || null) : null,
    separation_date:  isSep ? (date || fallbackDate) : null,
  };
}

export function unionToState4(u: { union_type: string; separation_date: string | null }): UnionState4 {
  if (u.union_type === "couple") return u.separation_date ? "ex-couple" : "couple";
  return u.separation_date ? "divorce" : "marriage";
}
