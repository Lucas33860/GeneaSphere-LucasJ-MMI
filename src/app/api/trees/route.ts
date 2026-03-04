import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TreeRow = { id: string; name: string; owner_id: string; created_at: string };

async function enrichTree(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tree: TreeRow,
  role: string,
) {
  const [{ count }, { data: ownerProfile }] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }).eq("tree_id", tree.id),
    supabase.from("profiles").select("full_name, email").eq("id", tree.owner_id).single(),
  ]);
  return {
    ...tree,
    role,
    member_count: count ?? 0,
    owner_name: ownerProfile?.full_name ?? ownerProfile?.email ?? "Inconnu",
  };
}

// GET /api/trees — liste les arbres de l'utilisateur (propriétaire + partagés)
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Arbres dont l'utilisateur est propriétaire
  const { data: ownedTrees, error: ownErr } = await supabase
    .from("trees")
    .select("id, name, owner_id, created_at")
    .eq("owner_id", user.id)
    .order("created_at");

  if (ownErr) {
    console.error("[api/trees GET] ownedTrees error:", ownErr);
    return NextResponse.json({ error: ownErr.message }, { status: 500 });
  }

  // Accès partagés : d'abord juste les ids + rôles
  const { data: sharedAccess, error: sharedErr } = await supabase
    .from("tree_access")
    .select("role, tree_id")
    .eq("user_id", user.id);

  if (sharedErr) {
    console.error("[api/trees GET] sharedAccess error:", sharedErr);
    return NextResponse.json({ error: sharedErr.message }, { status: 500 });
  }

  // Charger chaque arbre partagé séparément
  const sharedTreesRaw: (TreeRow & { role: string })[] = [];
  for (const a of sharedAccess ?? []) {
    const { data: t } = await supabase
      .from("trees")
      .select("id, name, owner_id, created_at")
      .eq("id", a.tree_id)
      .single();
    if (t) sharedTreesRaw.push({ ...t, role: a.role });
  }

  const [owned, shared] = await Promise.all([
    Promise.all((ownedTrees ?? []).map(t => enrichTree(supabase, t, "owner"))),
    Promise.all(sharedTreesRaw.map(t => enrichTree(supabase, t, t.role))),
  ]);

  return NextResponse.json({ owned, shared });
}

// POST /api/trees — créer un arbre
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { name } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("trees")
    .insert({ name: name.trim(), owner_id: user.id })
    .select()
    .single();

  if (error) {
    console.error("[api/trees POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ...data, role: "owner", member_count: 0 }, { status: 201 });
}
