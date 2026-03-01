// La table parentage a été supprimée (migration 00003).
// father_id et mother_id sont maintenant des colonnes sur members.
// Ce fichier redirige vers PATCH /api/members/[child_id].

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/parentages/[child_id] — met à jour father_id/mother_id sur le membre
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { father_id, mother_id } = await request.json();

  const { data, error } = await supabase
    .from("members")
    .update({ father_id: father_id ?? null, mother_id: mother_id ?? null })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/parentages/[child_id] — efface father_id/mother_id du membre
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { error } = await supabase
    .from("members")
    .update({ father_id: null, mother_id: null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
