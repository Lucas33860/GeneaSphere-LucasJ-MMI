import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [{ data: members, error }, { count: unions_count }] = await Promise.all([
    supabase.from("members").select("id, first_name, last_name, birth_date, death_date"),
    supabase.from("spouses").select("id", { count: "exact", head: true }),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total_members  = members?.length ?? 0;
  const deceased_count = members?.filter(m => m.death_date).length ?? 0;

  // Membres vivants avec date de naissance
  const alive = (members ?? []).filter(m => m.birth_date && !m.death_date);
  alive.sort((a, b) => new Date(a.birth_date!).getTime() - new Date(b.birth_date!).getTime());

  const oldest_member = alive.length > 0
    ? { name: `${alive[0].first_name} ${alive[0].last_name}`, birth_date: alive[0].birth_date }
    : null;

  const now = Date.now();
  const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;
  const average_age = alive.length > 0
    ? Math.round(alive.reduce((sum, m) => sum + (now - new Date(m.birth_date!).getTime()) / MS_PER_YEAR, 0) / alive.length)
    : null;

  // Prénom le plus fréquent
  const nameCounts: Record<string, number> = {};
  (members ?? []).forEach(m => { nameCounts[m.first_name] = (nameCounts[m.first_name] ?? 0) + 1; });
  const most_common_name = Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return NextResponse.json({
    total_members,
    deceased_count,
    unions_count: unions_count ?? 0,
    oldest_member,
    average_age,
    most_common_name,
  });
}
