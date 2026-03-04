import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTreeRole, canShare } from "@/lib/tree-access";

type Params = { params: Promise<{ id: string }> };

// GET /api/trees/[id]/access — liste les accès
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = await getUserTreeRole(supabase, id, user.id);
  if (!role) return NextResponse.json({ error: "Arbre introuvable" }, { status: 404 });

  const { data, error } = await supabase
    .from("tree_access")
    .select("*, profiles:user_id(full_name, email)")
    .eq("tree_id", id)
    .order("granted_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (data ?? []).map(a => ({
    id: a.id,
    tree_id: a.tree_id,
    user_id: a.user_id,
    role: a.role,
    granted_at: a.granted_at,
    user_name: (a.profiles as { full_name?: string; email?: string } | null)?.full_name ?? null,
    user_email: (a.profiles as { full_name?: string; email?: string } | null)?.email ?? null,
  }));

  return NextResponse.json(enriched);
}

// POST /api/trees/[id]/access — ajouter/modifier un accès
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = await getUserTreeRole(supabase, id, user.id);
  if (!canShare(role)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { user_id, role: newRole } = await request.json();
  if (!user_id || !["reader", "editor", "admin"].includes(newRole)) {
    return NextResponse.json({ error: "user_id et role valide requis" }, { status: 400 });
  }
  if (user_id === user.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas vous partager l'arbre à vous-même" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tree_access")
    .upsert({ tree_id: id, user_id, role: newRole, granted_by: user.id }, { onConflict: "tree_id,user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
