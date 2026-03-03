import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Tous les membres de l'utilisateur
  const { data: members, error: mErr } = await supabase
    .from("members")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at");
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const memberIds = (members ?? []).map((m) => m.id);

  // Toutes les unions impliquant au moins un de ses membres
  let spouses: unknown[] = [];
  if (memberIds.length > 0) {
    const [res1, res2] = await Promise.all([
      supabase.from("spouses").select("*").in("member1_id", memberIds),
      supabase.from("spouses").select("*").in("member2_id", memberIds),
    ]);
    if (res1.error) return NextResponse.json({ error: res1.error.message }, { status: 500 });
    if (res2.error) return NextResponse.json({ error: res2.error.message }, { status: 500 });

    // Fusionner et dédoublonner par id
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
