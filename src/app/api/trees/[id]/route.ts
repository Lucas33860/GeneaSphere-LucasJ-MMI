import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTreeRole, canShare, canDelete } from "@/lib/tree-access";

type Params = { params: Promise<{ id: string }> };

// GET /api/trees/[id]
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = await getUserTreeRole(supabase, id, user.id);
  if (!role) return NextResponse.json({ error: "Arbre introuvable" }, { status: 404 });

  const { data: tree } = await supabase.from("trees").select("*").eq("id", id).single();
  const { data: access } = await supabase
    .from("tree_access")
    .select("*, profiles:user_id(full_name, email)")
    .eq("tree_id", id);

  return NextResponse.json({ ...tree, role, access: access ?? [] });
}

// PATCH /api/trees/[id] — renommer
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = await getUserTreeRole(supabase, id, user.id);
  if (!canShare(role)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  const { data, error } = await supabase
    .from("trees").update({ name: name.trim() }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/trees/[id] — supprimer (owner uniquement)
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = await getUserTreeRole(supabase, id, user.id);
  if (!canDelete(role) || role !== "owner") {
    return NextResponse.json({ error: "Seul le propriétaire peut supprimer un arbre" }, { status: 403 });
  }

  const { error } = await supabase.from("trees").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
