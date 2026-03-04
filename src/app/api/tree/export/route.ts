import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const treeId = searchParams.get("treeId");

  let membersQuery = supabase.from("members").select("*").order("created_at");
  if (treeId) {
    membersQuery = membersQuery.eq("tree_id", treeId);
  } else {
    membersQuery = membersQuery.eq("created_by", user.id);
  }

  const { data: members, error: mErr } = await membersQuery;
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const memberIds = (members ?? []).map((m) => m.id);

  let spouses: unknown[] = [];
  if (memberIds.length > 0) {
    const [res1, res2] = await Promise.all([
      supabase.from("spouses").select("*").in("member1_id", memberIds),
      supabase.from("spouses").select("*").in("member2_id", memberIds),
    ]);
    if (res1.error) return NextResponse.json({ error: res1.error.message }, { status: 500 });
    if (res2.error) return NextResponse.json({ error: res2.error.message }, { status: 500 });

    const seen = new Set<string>();
    spouses = [...(res1.data ?? []), ...(res2.data ?? [])].filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }

  return NextResponse.json({
    version: "1.0",
    exported_at: new Date().toISOString(),
    members: members ?? [],
    spouses,
  });
}
