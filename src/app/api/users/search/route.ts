import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/users/search?q= — rechercher des utilisateurs (max 10)
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
    .neq("id", user.id)
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
