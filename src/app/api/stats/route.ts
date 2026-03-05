import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const treeId = searchParams.get("treeId");

  let membersQuery = supabase
    .from("members")
    .select("id, first_name, last_name, birth_date, death_date, gender");
  if (treeId) membersQuery = membersQuery.eq("tree_id", treeId);

  let unionsQuery = supabase.from("spouses").select("union_type, separation_date");
  if (treeId) unionsQuery = unionsQuery.eq("tree_id", treeId);

  const [{ data: members, error }, { data: unions }] = await Promise.all([
    membersQuery,
    unionsQuery,
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const all      = members ?? [];
  const deceased = all.filter(m => m.death_date);
  const alive    = all.filter(m => !m.death_date);

  const MS_YEAR = 1000 * 60 * 60 * 24 * 365.25;
  const age = (b: string, d?: string | null) =>
    Math.floor(((d ? new Date(d) : new Date()).getTime() - new Date(b).getTime()) / MS_YEAR);

  const withBirth     = alive.filter(m => m.birth_date);
  const deadWithBirth = deceased.filter(m => m.birth_date);
  const byAge         = [...withBirth].sort((a, b) => new Date(a.birth_date!).getTime() - new Date(b.birth_date!).getTime());
  const last          = byAge[byAge.length - 1];

  const oldest_member   = byAge[0] ? { name: `${byAge[0].first_name} ${byAge[0].last_name}`,   age: age(byAge[0].birth_date!),  birth_date: byAge[0].birth_date  } : null;
  const youngest_member = last     ? { name: `${last.first_name} ${last.last_name}`,             age: age(last.birth_date!),      birth_date: last.birth_date      } : null;
  const average_age         = withBirth.length     ? Math.round(withBirth.reduce((s, m)     => s + age(m.birth_date!),             0) / withBirth.length)     : null;
  const average_age_at_death = deadWithBirth.length ? Math.round(deadWithBirth.reduce((s, m) => s + age(m.birth_date!, m.death_date), 0) / deadWithBirth.length) : null;

  const male_count   = all.filter(m => m.gender === "male").length;
  const female_count = all.filter(m => m.gender === "female").length;
  const other_count  = all.filter(m => m.gender === "other").length;
  const no_gender_count = all.filter(m => !m.gender).length;

  // Stats par genre
  const genderStats = (gender: string) => {
    const g        = all.filter(m => m.gender === gender);
    const gAlive   = g.filter(m => !m.death_date);
    const gDead    = g.filter(m =>  m.death_date);
    const gWithB   = gAlive.filter(m => m.birth_date);
    const gDeadWB  = gDead.filter(m => m.birth_date);
    const avgAge   = gWithB.length  ? Math.round(gWithB.reduce((s, m) => s + age(m.birth_date!), 0) / gWithB.length) : null;
    const avgDeath = gDeadWB.length ? Math.round(gDeadWB.reduce((s, m) => s + age(m.birth_date!, m.death_date), 0) / gDeadWB.length) : null;
    const byAge    = [...gWithB].sort((a, b) => new Date(a.birth_date!).getTime() - new Date(b.birth_date!).getTime());
    const oldest   = byAge[0] ? { name: `${byAge[0].first_name} ${byAge[0].last_name}`, age: age(byAge[0].birth_date!), birth_date: byAge[0].birth_date } : null;
    const fNames: Record<string, number> = {};
    g.forEach(m => { fNames[m.first_name] = (fNames[m.first_name] ?? 0) + 1; });
    const mostCommonName = Object.entries(fNames).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { living: gAlive.length, deceased: gDead.length, average_age: avgAge, average_age_at_death: avgDeath, oldest, most_common_first_name: mostCommonName };
  };

  const maleStats   = genderStats("male");
  const femaleStats = genderStats("female");
  const otherStats  = genderStats("other");

  const firstNames: Record<string, number> = {};
  const lastNames:  Record<string, number> = {};
  all.forEach(m => {
    firstNames[m.first_name] = (firstNames[m.first_name] ?? 0) + 1;
    lastNames[m.last_name]   = (lastNames[m.last_name]   ?? 0) + 1;
  });
  const most_common_first_name = Object.entries(firstNames).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const last_names_top5 = Object.entries(lastNames)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const decades: Record<number, number> = {};
  all.filter(m => m.birth_date).forEach(m => {
    const d = Math.floor(new Date(m.birth_date!).getFullYear() / 10) * 10;
    decades[d] = (decades[d] ?? 0) + 1;
  });
  const birth_decades = Object.entries(decades)
    .sort((a, b) => +a[0] - +b[0])
    .map(([decade, count]) => ({ decade: +decade, count }));

  const ua = unions ?? [];
  const couple_count    = ua.filter(u => u.union_type === "couple"   && !u.separation_date).length;
  const ex_couple_count = ua.filter(u => u.union_type === "couple"   &&  u.separation_date).length;
  const marriage_count  = ua.filter(u => u.union_type === "marriage" && !u.separation_date).length;
  const divorce_count   = ua.filter(u => u.union_type === "marriage" &&  u.separation_date).length;

  return NextResponse.json({
    total_members: all.length, living_count: alive.length, deceased_count: deceased.length,
    male_count, female_count, other_count, no_gender_count,
    male_living: maleStats.living, male_deceased: maleStats.deceased,
    female_living: femaleStats.living, female_deceased: femaleStats.deceased,
    other_living: otherStats.living, other_deceased: otherStats.deceased,
    average_age_male: maleStats.average_age, average_age_female: femaleStats.average_age,
    average_age_at_death_male: maleStats.average_age_at_death, average_age_at_death_female: femaleStats.average_age_at_death,
    oldest_male: maleStats.oldest, oldest_female: femaleStats.oldest,
    most_common_first_name_male: maleStats.most_common_first_name, most_common_first_name_female: femaleStats.most_common_first_name,
    total_unions: ua.length, couple_count, ex_couple_count, marriage_count, divorce_count,
    oldest_member, youngest_member, average_age, average_age_at_death,
    most_common_first_name, last_names_top5, birth_decades,
  });
}
