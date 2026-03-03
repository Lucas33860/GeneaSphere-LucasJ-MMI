import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string; hid: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id, hid } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // 1. Charger le snapshot à restaurer
  const { data: snap, error: snapErr } = await supabase
    .from("member_history")
    .select("*")
    .eq("id", hid)
    .single();
  if (snapErr || !snap) return NextResponse.json({ error: "Snapshot introuvable" }, { status: 404 });

  // 2. Restaurer les champs du snapshot (sans enregistrer d'entrée supplémentaire)
  const { first_name, last_name, gender, birth_date, death_date, birth_place, photo_url, bio, is_private, father_id, mother_id } = snap;
  const { data: restored, error: restErr } = await supabase
    .from("members")
    .update({ first_name, last_name, gender, birth_date, death_date, birth_place, photo_url, bio, is_private, father_id, mother_id })
    .eq("id", id)
    .select()
    .single();

  if (restErr) return NextResponse.json({ error: restErr.message }, { status: 500 });
  return NextResponse.json(restored);
}
