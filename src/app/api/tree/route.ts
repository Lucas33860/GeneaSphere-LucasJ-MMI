import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get("person_id");
  if (!personId) return NextResponse.json({ error: "person_id requis" }, { status: 400 });

  // La personne — father_id et mother_id sont maintenant des colonnes sur members
  const { data: person, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", personId)
    .single();
  if (error) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });

  const fatherId = person.father_id as string | null;
  const motherId = person.mother_id as string | null;

  // Père et mère
  let father = null;
  let mother = null;
  if (fatherId) {
    const { data } = await supabase.from("members").select("*").eq("id", fatherId).single();
    father = data;
  }
  if (motherId) {
    const { data } = await supabase.from("members").select("*").eq("id", motherId).single();
    mother = data;
  }

  // Frères/sœurs complets (même père ET mère, selon ce qui est connu)
  let siblings: unknown[] = [];
  if (fatherId || motherId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from("members").select("*").neq("id", personId);
    if (fatherId) q = q.eq("father_id", fatherId); else q = q.is("father_id", null);
    if (motherId) q = q.eq("mother_id", motherId); else q = q.is("mother_id", null);
    const { data } = await q;
    siblings = data ?? [];
  }

  // Union des parents
  let parentUnion = null;
  if (fatherId && motherId) {
    const { data } = await supabase
      .from("spouses")
      .select("*")
      .or(
        `and(member1_id.eq.${fatherId},member2_id.eq.${motherId}),` +
        `and(member1_id.eq.${motherId},member2_id.eq.${fatherId})`
      )
      .maybeSingle();
    parentUnion = data;
  }

  const sibIds = new Set((siblings as Array<{ id: string }>).map(s => s.id));

  type ExtraUnion = {
    union: Record<string, unknown> | null;
    partner: Record<string, unknown> | null;
    children: Record<string, unknown>[];
  };

  // ── Autres unions de la mère ──────────────────────────────────
  // On cherche tous les enfants de la mère, on groupe par father_id
  const motherOtherUnions: ExtraUnion[] = [];
  if (motherId) {
    const { data: motherChildren } = await supabase
      .from("members")
      .select("*")
      .eq("mother_id", motherId)
      .neq("id", personId);

    const byFather = new Map<string | null, Record<string, unknown>[]>();
    for (const child of (motherChildren ?? [])) {
      if (sibIds.has(child.id)) continue;
      const fid = (child.father_id as string | null) ?? null;
      if (!byFather.has(fid)) byFather.set(fid, []);
      byFather.get(fid)!.push(child as Record<string, unknown>);
    }

    for (const [fid, children] of byFather.entries()) {
      if (fid === fatherId) continue;
      if (fid === null) {
        motherOtherUnions.push({ union: null, partner: null, children });
      } else {
        const { data: partner } = await supabase.from("members").select("*").eq("id", fid).single();
        if (!partner) continue;
        const { data: union } = await supabase.from("spouses").select("*").or(
          `and(member1_id.eq.${motherId},member2_id.eq.${fid}),` +
          `and(member1_id.eq.${fid},member2_id.eq.${motherId})`
        ).maybeSingle();
        motherOtherUnions.push({ union: union ?? null, partner, children });
      }
    }
  }

  // ── Autres unions du père ─────────────────────────────────────
  const fatherOtherUnions: ExtraUnion[] = [];
  if (fatherId) {
    const { data: fatherChildren } = await supabase
      .from("members")
      .select("*")
      .eq("father_id", fatherId)
      .neq("id", personId);

    const byMother = new Map<string | null, Record<string, unknown>[]>();
    for (const child of (fatherChildren ?? [])) {
      if (sibIds.has(child.id)) continue;
      const mid = (child.mother_id as string | null) ?? null;
      if (!byMother.has(mid)) byMother.set(mid, []);
      byMother.get(mid)!.push(child as Record<string, unknown>);
    }

    for (const [mid, children] of byMother.entries()) {
      if (mid === motherId) continue;
      if (mid === null) {
        fatherOtherUnions.push({ union: null, partner: null, children });
      } else {
        const { data: partner } = await supabase.from("members").select("*").eq("id", mid).single();
        if (!partner) continue;
        const { data: union } = await supabase.from("spouses").select("*").or(
          `and(member1_id.eq.${fatherId},member2_id.eq.${mid}),` +
          `and(member1_id.eq.${mid},member2_id.eq.${fatherId})`
        ).maybeSingle();
        fatherOtherUnions.push({ union: union ?? null, partner, children });
      }
    }
  }

  // ── Propres unions (conjoint·e·s + enfants) ───────────────────
  type OwnUnion = {
    union: Record<string, unknown>;
    partner: Record<string, unknown>;
    children: Record<string, unknown>[];
  };
  const ownUnions: OwnUnion[] = [];
  const { data: ownSpousesData } = await supabase
    .from("spouses")
    .select("*")
    .or(`member1_id.eq.${personId},member2_id.eq.${personId}`);

  for (const u of (ownSpousesData ?? [])) {
    const partnerId = u.member1_id === personId ? u.member2_id : u.member1_id;
    const { data: partner } = await supabase.from("members").select("*").eq("id", partnerId).single();
    if (!partner) continue;

    // Enfants : person peut être père ou mère
    const { data: childData } = await supabase
      .from("members")
      .select("*")
      .or(
        `and(father_id.eq.${personId},mother_id.eq.${partnerId}),` +
        `and(mother_id.eq.${personId},father_id.eq.${partnerId})`
      );

    ownUnions.push({ union: u, partner, children: childData ?? [] });
  }

  return NextResponse.json({
    person, father, mother, siblings, parentUnion,
    motherOtherUnions, fatherOtherUnions, ownUnions,
  });
}
