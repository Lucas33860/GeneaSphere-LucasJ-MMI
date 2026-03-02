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
    const { data, error: sErr } = await supabase
      .from("spouses")
      .select("*")
      .or(`member1_id.in.(${memberIds.join(",")}),member2_id.in.(${memberIds.join(",")})`);
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    spouses = data ?? [];
  }

  return NextResponse.json({
    version: "1.0",
    exported_at: new Date().toISOString(),
    members: members ?? [],
    spouses,
  });
}
