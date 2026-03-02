"use client";

import { UNION_STATE_OPTIONS, type UnionState4 } from "@/lib/union";

export function UnionStateSelector({ value, onChange }: {
  value: UnionState4 | null;
  onChange: (v: UnionState4) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {UNION_STATE_OPTIONS.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={`flex flex-col items-center gap-0.5 py-3 rounded-xl border-2 font-semibold text-xs transition-all ${
            value === opt.value
              ? opt.active + " shadow-sm scale-[1.02]"
              : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-white"
          }`}>
          <span className="text-xl">{opt.picto}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
