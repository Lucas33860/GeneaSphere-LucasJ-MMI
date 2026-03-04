import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { memberSchema } from "@/lib/schemas/member";
import { getUserTreeRole, canWrite, canDelete } from "@/lib/tree-access";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data, error } = await supabase.from("members").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Récupérer le tree_id du membre pour vérifier les droits
  const { data: existing } = await supabase.from("members").select("tree_id").eq("id", id).single();
  if (existing?.tree_id) {
    const role = await getUserTreeRole(supabase, existing.tree_id, user.id);
    if (!canWrite(role)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = memberSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Snapshot l'état courant avant modification
  const { data: old } = await supabase.from("members").select("*").eq("id", id).single();
  if (old) {
    const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb, tree_id: _tid, ...fields } = old;
    await supabase.from("member_history").insert({
      member_id: id, ...fields,
      changed_by: user.id, change_type: "update",
    });
  }

  const { data, error } = await supabase
    .from("members")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: existing } = await supabase.from("members").select("tree_id").eq("id", id).single();
  if (existing?.tree_id) {
    const role = await getUserTreeRole(supabase, existing.tree_id, user.id);
    if (!canDelete(role)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
