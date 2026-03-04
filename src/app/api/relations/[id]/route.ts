import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTreeRole, canWrite, canDelete } from "@/lib/tree-access";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: existing } = await supabase.from("spouses").select("tree_id").eq("id", id).single();
  if (existing?.tree_id) {
    const role = await getUserTreeRole(supabase, existing.tree_id, user.id);
    if (!canWrite(role)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const { union_date, separation_date, union_type } = body;

  const { data, error } = await supabase
    .from("spouses")
    .update({
      union_date: union_date ?? null,
      separation_date: separation_date ?? null,
      ...(union_type ? { union_type } : {}),
    })
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

  const { data: existing } = await supabase.from("spouses").select("tree_id").eq("id", id).single();
  if (existing?.tree_id) {
    const role = await getUserTreeRole(supabase, existing.tree_id, user.id);
    if (!canDelete(role)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { error } = await supabase.from("spouses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
