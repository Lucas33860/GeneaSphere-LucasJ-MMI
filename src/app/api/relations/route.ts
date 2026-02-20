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
  union_date: z.string().date().nullable().optional(),
  separation_date: z.string().date().nullable().optional(),
});

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
