import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: members, error } = await supabase
    .from("members")
    .select("id, first_name, last_name, birth_date, death_date");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    total_members: members?.length ?? 0,
    members_with_birth_date: members?.filter((m) => m.birth_date).length ?? 0,
  });
}
