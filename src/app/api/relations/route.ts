import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const spouseSchema = z.object({
  member1_id: z.string().uuid(),
  member2_id: z.string().uuid(),
  union_type: z.enum(['couple', 'marriage']).default('marriage').optional(),
  union_date: z.string().date().nullable().optional(),
  separation_date: z.string().date().nullable().optional(),
});

// ── GET : liste toutes les unions ─────────────────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: unions, error } = await supabase
    .from("spouses")
    .select(`
      *,
      member1:member1_id ( id, first_name, last_name ),
      member2:member2_id ( id, first_name, last_name )
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Parentés : membres ayant au moins un parent renseigné (father_id / mother_id)
  const { data: allMembers } = await supabase
    .from("members")
    .select("id, first_name, last_name, father_id, mother_id");

  const membersMap = new Map((allMembers ?? []).map(m => [m.id, m]));
  const parentages = (allMembers ?? [])
    .filter(m => m.father_id || m.mother_id)
    .map(m => ({
      id:        m.id,
      child_id:  m.id,
      father_id: m.father_id ?? null,
      mother_id: m.mother_id ?? null,
      child:  { id: m.id, first_name: m.first_name, last_name: m.last_name },
      father: m.father_id ? (membersMap.get(m.father_id) ?? null) : null,
      mother: m.mother_id ? (membersMap.get(m.mother_id) ?? null) : null,
    }));

  return NextResponse.json({ unions: unions ?? [], parentages });
}

// ── POST : créer une union ────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json();
  const { type, ...rest } = body;

  if (type === "spouse") {
    const parsed = spouseSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { data, error } = await supabase
      .from("spouses")
      .insert({ ...parsed.data, created_by: user.id })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  return NextResponse.json({ error: "Type invalide" }, { status: 400 });
}
