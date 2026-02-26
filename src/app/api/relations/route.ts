import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const parentageSchema = z.object({
  child_id: z.string().uuid(),
  father_id: z.string().uuid().nullable().optional(),
  mother_id: z.string().uuid().nullable().optional(),
});

const spouseSchema = z.object({
  member1_id: z.string().uuid(),
  member2_id: z.string().uuid(),
  union_type: z.enum(['couple', 'marriage']).default('marriage').optional(),
  union_date: z.string().date().nullable().optional(),
  separation_date: z.string().date().nullable().optional(),
});

// ── GET : liste toutes les unions et parentés avec noms des membres ──
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "unions" | "parentages" | null (les deux)

  const result: Record<string, unknown> = {};

  if (!type || type === "unions") {
    const { data: unions, error } = await supabase
      .from("spouses")
      .select(`
        *,
        member1:member1_id ( id, first_name, last_name ),
        member2:member2_id ( id, first_name, last_name )
      `)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result.unions = unions ?? [];
  }

  if (!type || type === "parentages") {
    const { data: parentages, error } = await supabase
      .from("parentage")
      .select(`
        *,
        child:child_id ( id, first_name, last_name ),
        father:father_id ( id, first_name, last_name ),
        mother:mother_id ( id, first_name, last_name )
      `)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result.parentages = parentages ?? [];
  }

  return NextResponse.json(result);
}

// ── POST : créer une union ou une parenté ────────────────────────
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json();
  const { type, ...rest } = body;

  if (type === "parentage") {
    const parsed = parentageSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { data, error } = await supabase.from("parentage").insert(parsed.data).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  if (type === "spouse") {
    const parsed = spouseSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { data, error } = await supabase.from("spouses").insert(parsed.data).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  return NextResponse.json({ error: "Type invalide" }, { status: 400 });
}
