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
  // On interroge directement la table spouses pour inclure toutes les unions,
  // même celles sans enfants communs.
  const motherOtherUnions: ExtraUnion[] = [];
  if (motherId) {
    const { data: motherSpouses } = await supabase
      .from("spouses")
      .select("*")
      .or(`member1_id.eq.${motherId},member2_id.eq.${motherId}`);

    for (const sp of (motherSpouses ?? [])) {
      const partnerId = sp.member1_id === motherId ? sp.member2_id : sp.member1_id;
      // Ignorer l'union principale (père biologique)
      if (fatherId && partnerId === fatherId) continue;

      const { data: partner } = await supabase.from("members").select("*").eq("id", partnerId).single();
      if (!partner) continue;

      // Enfants de cette union
      const { data: childData } = await supabase
        .from("members")
        .select("*")
        .or(
          `and(father_id.eq.${motherId},mother_id.eq.${partnerId}),` +
          `and(mother_id.eq.${motherId},father_id.eq.${partnerId})`
        );
      const children = (childData ?? []).filter(
        (c) => !sibIds.has(c.id) && c.id !== personId
      );
      motherOtherUnions.push({ union: sp, partner, children });
    }

    // Enfants de la mère sans père enregistré
    const { data: soloMotherData } = await supabase
      .from("members")
      .select("*")
      .eq("mother_id", motherId)
      .is("father_id", null)
      .neq("id", personId);
    const soloMotherChildren = (soloMotherData ?? []).filter((c) => !sibIds.has(c.id));
    if (soloMotherChildren.length > 0) {
      motherOtherUnions.push({ union: null, partner: null, children: soloMotherChildren });
    }
  }

  // ── Autres unions du père ─────────────────────────────────────
  const fatherOtherUnions: ExtraUnion[] = [];
  if (fatherId) {
    const { data: fatherSpouses } = await supabase
      .from("spouses")
      .select("*")
      .or(`member1_id.eq.${fatherId},member2_id.eq.${fatherId}`);

    for (const sp of (fatherSpouses ?? [])) {
      const partnerId = sp.member1_id === fatherId ? sp.member2_id : sp.member1_id;
      // Ignorer l'union principale (mère biologique)
      if (motherId && partnerId === motherId) continue;

      const { data: partner } = await supabase.from("members").select("*").eq("id", partnerId).single();
      if (!partner) continue;

      // Enfants de cette union
      const { data: childData } = await supabase
        .from("members")
        .select("*")
        .or(
          `and(father_id.eq.${fatherId},mother_id.eq.${partnerId}),` +
          `and(mother_id.eq.${fatherId},father_id.eq.${partnerId})`
        );
      const children = (childData ?? []).filter(
        (c) => !sibIds.has(c.id) && c.id !== personId
      );
      fatherOtherUnions.push({ union: sp, partner, children });
    }

    // Enfants du père sans mère enregistrée
    const { data: soloFatherData } = await supabase
      .from("members")
      .select("*")
      .eq("father_id", fatherId)
      .is("mother_id", null)
      .neq("id", personId);
    const soloFatherChildren = (soloFatherData ?? []).filter((c) => !sibIds.has(c.id));
    if (soloFatherChildren.length > 0) {
      fatherOtherUnions.push({ union: null, partner: null, children: soloFatherChildren });
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

  // Enfants nés sans autre parent enregistré (parent unique)
  const { data: soloAsFather } = await supabase
    .from("members").select("*")
    .eq("father_id", personId).is("mother_id", null);
  const { data: soloAsMother } = await supabase
    .from("members").select("*")
    .eq("mother_id", personId).is("father_id", null);
  const soloKids = [...(soloAsFather ?? []), ...(soloAsMother ?? [])];
  if (soloKids.length > 0) {
    (ownUnions as Array<{ union: unknown; partner: unknown; children: unknown[] }>)
      .push({ union: null, partner: null, children: soloKids });
  }

  return NextResponse.json({
    person, father, mother, siblings, parentUnion,
    motherOtherUnions, fatherOtherUnions, ownUnions,
  });
}
