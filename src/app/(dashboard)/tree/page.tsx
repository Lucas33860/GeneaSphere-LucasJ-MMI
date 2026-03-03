"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FamilyTree3D } from "@/components/tree/FamilyTree3D";
import type { Member, Spouse } from "@/types";
import { darkInputCls } from "@/lib/ui";
import { uploadMemberPhoto } from "@/lib/supabase/storage";
import { type UnionState4, UNION_STATE_OPTIONS, stateToBody, unionToState4 } from "@/lib/union";

// ── Schemas ───────────────────────────────────────────────────────
const editMemberSchema = z.object({
  first_name:  z.string().min(1, "Requis"),
  last_name:   z.string().min(1, "Requis"),
  gender:      z.enum(["male", "female", "other", ""]).optional(),
  birth_date:  z.string().optional(),
  birth_place: z.string().optional(),
  death_date:  z.string().optional(),
  bio:         z.string().optional(),
});
type EditMemberInput = z.infer<typeof editMemberSchema>;

// ── Page principale ───────────────────────────────────────────────
export default function TreePage() {
  const [members, setMembers]       = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [resetKey, setResetKey]       = useState(0);
  const [importStatus, setImportStatus] = useState<{ type: "ok" | "err" | "loading"; msg: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const [panel, setPanel] = useState<
    { type: "member"; data: Member; editing: boolean } |
    { type: "union";  data: Spouse; editing: boolean } |
    null
  >(null);

  useEffect(() => {
    fetch("/api/members")
      .then(r => r.json())
      .then((data: Member[]) => {
        setMembers(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(() => setMemberError("Impossible de charger les membres"));
  }, []);

  const handleSelectMember = (m: Member) => setPanel({ type: "member", data: m, editing: false });
  const handleSelectUnion  = (u: Spouse) => setPanel({ type: "union",  data: u, editing: false });

  const handleExport = async () => {
    const res = await fetch("/api/tree/export");
    if (!res.ok) return;
    const json = await res.json();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `geneasphere-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus({ type: "loading", msg: "Import en cours…" });
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch("/api/tree/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportStatus({ type: "err", msg: data.error ?? "Erreur lors de l'import" });
      } else {
        setImportStatus({ type: "ok", msg: `${data.members_created} membres + ${data.spouses_created} unions importés.` });
        // Recharger la liste des membres
        const memRes = await fetch("/api/members");
        if (memRes.ok) {
          const updated: Member[] = await memRes.json();
          setMembers(updated);
          if (updated.length > 0 && !selectedId) setSelectedId(updated[0].id);
        }
        setResetKey(k => k + 1);
      }
    } catch {
      setImportStatus({ type: "err", msg: "Fichier JSON invalide." });
    }
    if (importRef.current) importRef.current.value = "";
    setTimeout(() => setImportStatus(null), 5000);
  };

  const legendItems = [
    { picto: "♥",   label: "Couple",     color: "text-pink-400" },
    { picto: "💔",  label: "Ex-couple",  color: "text-slate-400" },
    { picto: "💍",  label: "Marié·e",    color: "text-amber-400" },
    { picto: "💍✗", label: "Divorcé·e",  color: "text-slate-500" },
    { picto: "†",   label: "Décédé·e",   color: "text-slate-500" },
  ];

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col" style={{ height: "calc(100vh - 56px)" }}>

      {/* ── Barre de contrôle ─────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-800/80 backdrop-blur border-b border-white/10 shrink-0">
        <span className="text-white font-semibold text-sm hidden sm:block">Arbre 3D</span>

        {memberError ? (
          <p className="text-xs text-red-400 bg-red-900/30 px-3 py-1 rounded-lg">{memberError}</p>
        ) : members.length > 0 ? (
          <select
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setPanel(null); }}
            className="bg-white/10 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-50"
          >
            {members.map(m => (
              <option key={m.id} value={m.id} className="bg-slate-800">
                {m.first_name} {m.last_name}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-slate-400">
            Aucun membre.{" "}
            <a href="/members" className="text-indigo-400 underline">Ajoutez-en d&apos;abord.</a>
          </p>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Légende inline petite */}
          <div className="hidden lg:flex items-center gap-3">
            {legendItems.map(({ picto, label, color }) => (
              <span key={label} className={`flex items-center gap-1 text-xs ${color}`}>
                <span>{picto}</span>
                <span className="text-slate-400">{label}</span>
              </span>
            ))}
          </div>
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="lg:hidden text-slate-400 hover:text-white px-2 py-1 rounded text-xs"
          >
            Légende
          </button>
          <div className="hidden lg:flex text-xs text-slate-500 gap-3 ml-2 border-l border-white/10 pl-3">
            <span>🖱 Drag = rotation</span>
            <span>🔍 Scroll = zoom</span>
            <span>Clic = info</span>
          </div>

          {/* Séparateur */}
          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Reset arbre */}
          <button
            title="Ferme les branches ouvertes et revient à la vue initiale de la personne sélectionnée"
            onClick={() => { setResetKey(k => k + 1); setPanel(null); }}
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <span className="text-sm">🔄</span>
            <span className="text-[10px] leading-none">Réinitialiser</span>
          </button>

          {/* Export JSON */}
          <button
            title="Télécharger l'arbre complet au format JSON"
            onClick={handleExport}
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <span className="text-sm">📤</span>
            <span className="text-[10px] leading-none">Exporter</span>
          </button>

          {/* Import JSON */}
          <label
            title="Importer un arbre depuis un fichier JSON"
            className="cursor-pointer flex flex-col items-center gap-0.5 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <span className="text-sm">📥</span>
            <span className="text-[10px] leading-none">Importer</span>
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImport}
            />
          </label>
        </div>
      </div>

      {/* ── Zone canvas ───────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">

        {/* Canvas 3D */}
        {/* Notification import */}
        {importStatus && (
          <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl text-sm font-medium shadow-lg border ${
            importStatus.type === "ok"      ? "bg-emerald-900/90 text-emerald-300 border-emerald-700" :
            importStatus.type === "err"     ? "bg-red-900/90 text-red-300 border-red-700" :
                                              "bg-slate-800/90 text-slate-300 border-white/10"
          }`}>
            {importStatus.type === "loading" ? "⏳ " : importStatus.type === "ok" ? "✓ " : "✕ "}
            {importStatus.msg}
          </div>
        )}

        {selectedId ? (
          <FamilyTree3D
            rootId={selectedId}
            resetKey={resetKey}
            onSelectMember={handleSelectMember}
            onSelectUnion={handleSelectUnion}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Sélectionnez un membre pour démarrer.
          </div>
        )}

        {/* Légende mobile */}
        {sidebarOpen && (
          <div className="absolute top-2 right-2 z-20 bg-slate-800/95 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-xl">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Légende</p>
            {legendItems.map(({ picto, label, color }) => (
              <p key={label} className={`flex items-center gap-2 text-sm mb-1.5 ${color}`}>
                <span className="w-5 text-center">{picto}</span>
                <span className="text-slate-300">{label}</span>
              </p>
            ))}
            <div className="mt-3 pt-3 border-t border-white/10 text-xs text-slate-500 space-y-1">
              <p>🎨 Couleur = lignée (nom de famille)</p>
              <p>Clic sphère = infos + expansion</p>
            </div>
          </div>
        )}

        {/* ── Panneau info/édition ──────────────────────────── */}
        {panel && (
          <div className="absolute top-3 left-3 z-20 w-80 bg-slate-900/95 backdrop-blur border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

            {/* Panneau MEMBRE — vue */}
            {panel.type === "member" && !panel.editing && (
              <MemberPanel
                member={panel.data}
                members={members}
                onEdit={() => setPanel({ ...panel, editing: true })}
                onClose={() => setPanel(null)}
              />
            )}

            {/* Panneau MEMBRE — édition */}
            {panel.type === "member" && panel.editing && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-white text-sm">Modifier</p>
                  <button onClick={() => setPanel({ ...panel, editing: false })} className="text-slate-400 hover:text-white text-xs">✕</button>
                </div>
                <EditMemberForm
                  member={panel.data}
                  onCancel={() => setPanel({ ...panel, editing: false })}
                  onSuccess={updated => {
                    setPanel({ type: "member", data: updated, editing: false });
                    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
                  }}
                />
              </div>
            )}

            {/* Panneau UNION — vue */}
            {panel.type === "union" && !panel.editing && (
              <UnionPanel
                union={panel.data}
                onEdit={() => setPanel({ ...panel, editing: true })}
                onClose={() => setPanel(null)}
              />
            )}

            {/* Panneau UNION — édition */}
            {panel.type === "union" && panel.editing && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-white text-sm">Modifier l&apos;union</p>
                  <button onClick={() => setPanel({ ...panel, editing: false })} className="text-slate-400 hover:text-white text-xs">✕</button>
                </div>
                <EditUnionForm
                  union={panel.data}
                  onCancel={() => setPanel({ ...panel, editing: false })}
                  onSuccess={updated => setPanel({ type: "union", data: updated, editing: false })}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Panneau membre ────────────────────────────────────────────────
function MemberPanel({ member, members, onEdit, onClose }: {
  member: Member; members: Member[]; onEdit: () => void; onClose: () => void;
}) {
  const father = members.find(m => m.id === member.father_id);
  const mother = members.find(m => m.id === member.mother_id);
  const isDead = !!member.death_date;
  const age = member.birth_date
    ? (isDead
        ? new Date(member.death_date!).getFullYear() - new Date(member.birth_date).getFullYear()
        : new Date().getFullYear() - new Date(member.birth_date).getFullYear())
    : null;

  const genderLabel: Record<string, string> = { male: "♂ Homme", female: "♀ Femme", other: "⚥ Autre" };

  return (
    <>
      {/* Header avec photo */}
      <div className="relative">
        {member.photo_url ? (
          <div className="h-32 overflow-hidden">
            <img src={member.photo_url} alt={member.first_name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-slate-900 via-slate-900/20 to-transparent" />
          </div>
        ) : (
          <div className="h-20 bg-linear-to-br from-indigo-900 to-slate-900" />
        )}
        <button onClick={onClose} className="absolute top-2 right-2 bg-black/40 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs hover:bg-black/60">✕</button>
        <div className="absolute bottom-0 left-4 translate-y-1/2">
          <div className="w-14 h-14 rounded-full bg-indigo-800 border-2 border-slate-900 flex items-center justify-center text-lg font-bold text-white overflow-hidden">
            {member.photo_url
              ? <img src={member.photo_url} alt="" className="w-full h-full object-cover" />
              : <>{member.first_name[0]}{member.last_name[0]}</>
            }
          </div>
        </div>
      </div>

      {/* Infos */}
      <div className="pt-10 px-4 pb-4 space-y-3">
        <div>
          <p className="font-bold text-white text-base leading-tight">{member.first_name} {member.last_name.toUpperCase()}</p>
          <p className="text-slate-400 text-xs mt-0.5">
            {member.gender ? genderLabel[member.gender] : "Genre inconnu"}
            {age != null && ` · ${age} ans`}
            {isDead && " · †"}
          </p>
        </div>

        <div className="space-y-1.5">
          {member.birth_date && (
            <InfoRowDark label="Naissance" value={
              new Date(member.birth_date).toLocaleDateString("fr-FR") +
              (member.birth_place ? ` — ${member.birth_place}` : "")
            } />
          )}
          {member.death_date && (
            <InfoRowDark label="Décès" value={new Date(member.death_date).toLocaleDateString("fr-FR")} />
          )}
          {(father || mother) && (
            <InfoRowDark
              label="Parents"
              value={[father && `${father.first_name} ${father.last_name}`, mother && `${mother.first_name} ${mother.last_name}`].filter(Boolean).join(" · ")}
            />
          )}
          {member.bio && <InfoRowDark label="Bio" value={member.bio} />}
          {member.is_private && <InfoRowDark label="Visibilité" value="Profil privé 🔒" />}
        </div>

        <button
          onClick={onEdit}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          Modifier
        </button>
      </div>
    </>
  );
}

// ── Panneau union ─────────────────────────────────────────────────
function UnionPanel({ union, onEdit, onClose }: { union: Spouse; onEdit: () => void; onClose: () => void }) {
  const sep = !!union.separation_date;
  const isCouple = union.union_type === "couple";
  const picto = isCouple ? (sep ? "💔" : "♥") : (sep ? "💍✗" : "💍");
  const label = isCouple ? (sep ? "Ex-couple" : "Couple") : (sep ? "Divorcé·e" : "Marié·e");
  const color = isCouple ? (sep ? "from-slate-700 to-slate-800" : "from-pink-800 to-rose-900")
                         : (sep ? "from-slate-700 to-slate-800" : "from-amber-800 to-yellow-900");

  return (
    <>
      <div className={`h-16 bg-linear-to-br ${color} flex items-center justify-between px-4`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{picto}</span>
          <span className="text-white font-bold">{label}</span>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white text-sm">✕</button>
      </div>
      <div className="px-4 py-4 space-y-2">
        {union.union_date && (
          <InfoRowDark label="Début" value={new Date(union.union_date).toLocaleDateString("fr-FR")} />
        )}
        {union.separation_date && (
          <InfoRowDark label="Séparation" value={new Date(union.separation_date).toLocaleDateString("fr-FR")} />
        )}
        {!union.union_date && !union.separation_date && (
          <p className="text-slate-500 text-xs">Aucune date renseignée</p>
        )}
        <button
          onClick={onEdit}
          className="w-full bg-pink-600 hover:bg-pink-500 text-white py-2 rounded-xl text-sm font-semibold transition-colors mt-2"
        >
          Modifier
        </button>
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────
function InfoRowDark({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-slate-200 text-sm font-medium">{value}</p>
    </div>
  );
}

// ── Formulaire édition membre ─────────────────────────────────────
function EditMemberForm({ member, onCancel, onSuccess }: { member: Member; onCancel: () => void; onSuccess: (u: Member) => void }) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(member.photo_url ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EditMemberInput>({
    resolver: zodResolver(editMemberSchema),
    defaultValues: {
      first_name:  member.first_name,
      last_name:   member.last_name,
      gender:      member.gender ?? "",
      birth_date:  member.birth_date ?? "",
      birth_place: member.birth_place ?? "",
      death_date:  member.death_date ?? "",
      bio:         member.bio ?? "",
    },
  });

  const onSubmit = async (data: EditMemberInput) => {
    setSubmitError(null);
    let photoUrl = member.photo_url ?? null;

    const file = fileRef.current?.files?.[0];
    if (file) {
      setUploading(true);
      const uploaded = await uploadMemberPhoto(file);
      if (uploaded) photoUrl = uploaded;
      setUploading(false);
    }

    const res = await fetch(`/api/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        gender:      data.gender      || null,
        birth_date:  data.birth_date  || null,
        birth_place: data.birth_place || null,
        death_date:  data.death_date  || null,
        bio:         data.bio         || null,
        photo_url:   photoUrl,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setSubmitError(j.error ?? "Erreur lors de la sauvegarde");
      return;
    }
    onSuccess(await res.json());
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {submitError && (
        <p className="text-red-400 text-xs bg-red-900/30 px-3 py-2 rounded-lg">{submitError}</p>
      )}

      {/* Photo */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
          {preview
            ? <img src={preview} alt="" className="w-full h-full object-cover" />
            : <span className="text-xl text-slate-500">📷</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={e => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : (member.photo_url ?? null));
            }}
            className="block w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-900/50 file:text-indigo-300 hover:file:bg-indigo-900"
          />
          {preview && preview !== member.photo_url && (
            <button type="button" onClick={() => { setPreview(member.photo_url ?? null); if (fileRef.current) fileRef.current.value = ""; }}
              className="text-xs text-slate-500 hover:text-red-400 mt-0.5">
              Annuler le changement
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <input {...register("first_name")} placeholder="Prénom" className={darkInputCls} />
          {errors.first_name && <p className="text-red-400 text-xs mt-0.5">{errors.first_name.message}</p>}
        </div>
        <div>
          <input {...register("last_name")} placeholder="Nom" className={darkInputCls} />
          {errors.last_name && <p className="text-red-400 text-xs mt-0.5">{errors.last_name.message}</p>}
        </div>
      </div>

      <select {...register("gender")} className={darkInputCls + " [&>option]:bg-slate-800"}>
        <option value="">Genre —</option>
        <option value="male">Homme</option>
        <option value="female">Femme</option>
        <option value="other">Autre</option>
      </select>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-slate-500 mb-1">Naissance</p>
          <input {...register("birth_date")} type="date" className={darkInputCls} />
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Décès</p>
          <input {...register("death_date")} type="date" className={darkInputCls} />
        </div>
      </div>

      <input {...register("birth_place")} placeholder="Lieu de naissance" className={darkInputCls} />
      <textarea {...register("bio")} placeholder="Biographie…" rows={2} className={darkInputCls + " resize-none"} />

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={isSubmitting || uploading}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
          {uploading ? "Upload…" : isSubmitting ? "Sauvegarde…" : "Sauvegarder"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-white/5">
          Annuler
        </button>
      </div>
    </form>
  );
}

// ── Formulaire édition union ──────────────────────────────────────
function EditUnionForm({ union, onCancel, onSuccess }: { union: Spouse; onCancel: () => void; onSuccess: (u: Spouse) => void }) {
  const [state, setState] = useState<UnionState4>(unionToState4(union));
  const [saveError, setSaveError] = useState<string | null>(null);
  const isSep = state === "ex-couple" || state === "divorce";

  const { register, handleSubmit, formState: { isSubmitting }, setValue } = useForm({
    defaultValues: { date: (isSep ? union.separation_date : union.union_date)?.slice(0, 10) ?? "" },
  });

  const handleStateChange = (v: UnionState4) => {
    setState(v);
    if (v === "ex-couple" || v === "divorce") {
      setValue("date", new Date().toISOString().slice(0, 10));
    }
  };

  const onSubmit = async (data: { date: string }) => {
    setSaveError(null);
    const res = await fetch(`/api/relations/${union.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stateToBody(state, data.date)),
    });
    if (!res.ok) {
      setSaveError((await res.json().catch(() => ({}))).error ?? "Erreur");
      return;
    }
    onSuccess(await res.json());
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {saveError && <p className="text-red-400 text-xs bg-red-900/30 px-3 py-2 rounded-lg">{saveError}</p>}

      <div className="grid grid-cols-2 gap-2">
        {UNION_STATE_OPTIONS.map(opt => (
          <button key={opt.value} type="button" onClick={() => handleStateChange(opt.value)}
            className={`flex flex-col items-center py-2.5 rounded-xl border transition-all text-xs font-semibold ${
              state === opt.value ? opt.active : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
            }`}>
            <span className="text-lg mb-0.5">{opt.picto}</span>
            {opt.label}
          </button>
        ))}
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1">{isSep ? "Date de séparation" : "Date de début"} (optionnel)</p>
        <input {...register("date")} type="date" className={darkInputCls} />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={isSubmitting}
          className="flex-1 bg-pink-600 hover:bg-pink-500 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
          {isSubmitting ? "Sauvegarde…" : "Sauvegarder"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-white/5">
          Annuler
        </button>
      </div>
    </form>
  );
}

