import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ImportedMember {
  id: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  birth_date: string | null;
  birth_place: string | null;
  death_date: string | null;
  bio: string | null;
  is_private: boolean;
  photo_url: string | null;
  father_id: string | null;
  mother_id: string | null;
}

interface ImportedSpouse {
  member1_id: string;
  member2_id: string;
  union_type: "couple" | "marriage";
  union_date: string | null;
  separation_date: string | null;
}

interface ImportPayload {
  members: ImportedMember[];
  spouses: ImportedSpouse[];
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let payload: ImportPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { members: importedMembers = [], spouses: importedSpouses = [] } = payload;

  if (!Array.isArray(importedMembers) || !Array.isArray(importedSpouses)) {
    return NextResponse.json({ error: "Format invalide (members et spouses doivent être des tableaux)" }, { status: 400 });
  }

  // Phase 1 — Créer tous les membres SANS les références père/mère
  // (pour éviter les erreurs de clé étrangère si le père n'est pas encore créé)
  const idMap = new Map<string, string>(); // oldId → newId

  for (const m of importedMembers) {
    const { data, error } = await supabase
      .from("members")
      .insert({
        first_name:  m.first_name,
        last_name:   m.last_name,
        gender:      m.gender   ?? null,
        birth_date:  m.birth_date  ?? null,
        birth_place: m.birth_place ?? null,
        death_date:  m.death_date  ?? null,
        bio:         m.bio         ?? null,
        is_private:  m.is_private  ?? false,
        photo_url:   m.photo_url   ?? null,
        created_by:  user.id,
        // father_id et mother_id ajoutés en phase 2
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: `Erreur création membre "${m.first_name} ${m.last_name}": ${error?.message}` },
        { status: 500 }
      );
    }
    idMap.set(m.id, data.id);
  }

  // Phase 2 — Mettre à jour les références père/mère avec les nouveaux IDs
  for (const m of importedMembers) {
    const newId   = idMap.get(m.id);
    if (!newId) continue;
    const father_id = m.father_id ? (idMap.get(m.father_id) ?? null) : null;
    const mother_id = m.mother_id ? (idMap.get(m.mother_id) ?? null) : null;
    if (father_id || mother_id) {
      await supabase
        .from("members")
        .update({ father_id, mother_id })
        .eq("id", newId);
    }
  }

  // Phase 3 — Créer les unions avec les nouveaux IDs
  let spousesCreated = 0;
  for (const sp of importedSpouses) {
    const member1_id = idMap.get(sp.member1_id);
    const member2_id = idMap.get(sp.member2_id);
    if (!member1_id || !member2_id) continue;

    const { error } = await supabase.from("spouses").insert({
      member1_id,
      member2_id,
      union_type:      sp.union_type      ?? "couple",
      union_date:      sp.union_date      ?? null,
      separation_date: sp.separation_date ?? null,
    });
    if (!error) spousesCreated++;
  }

  return NextResponse.json({
    success: true,
    members_created: idMap.size,
    spouses_created: spousesCreated,
  });
}
