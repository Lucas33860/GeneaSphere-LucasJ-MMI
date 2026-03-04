import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTreeRole, canShare } from "@/lib/tree-access";

type Params = { params: Promise<{ id: string; userId: string }> };

// PATCH /api/trees/[id]/access/[userId] — changer le rôle
export async function PATCH(request: Request, { params }: Params) {
  const { id, userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = await getUserTreeRole(supabase, id, user.id);
  if (!canShare(role)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { role: newRole } = await request.json();
  if (!["reader", "editor", "admin"].includes(newRole)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tree_access")
    .update({ role: newRole })
    .eq("tree_id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/trees/[id]/access/[userId] — révoquer l'accès
export async function DELETE(_req: Request, { params }: Params) {
  const { id, userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = await getUserTreeRole(supabase, id, user.id);
  if (!canShare(role)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { error } = await supabase
    .from("tree_access")
    .delete()
    .eq("tree_id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
