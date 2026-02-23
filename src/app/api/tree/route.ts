import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get("person_id");
  if (!personId) return NextResponse.json({ error: "person_id requis" }, { status: 400 });

  // La personne
  const { data: person, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", personId)
    .single();
  if (error) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });

  // Parenté de cette personne
  const { data: parentage } = await supabase
    .from("parentage")
    .select("*")
    .eq("child_id", personId)
    .maybeSingle();

  let father = null;
  let mother = null;

  if (parentage?.father_id) {
    const { data } = await supabase.from("members").select("*").eq("id", parentage.father_id).single();
    father = data;
  }
  if (parentage?.mother_id) {
    const { data } = await supabase.from("members").select("*").eq("id", parentage.mother_id).single();
    mother = data;
  }

  // ── Frères/sœurs COMPLETS (même père ET même mère) ────────────
  // → s'affichent sous le losange union père-mère
  let siblings: unknown[] = [];
  if (parentage?.father_id && parentage?.mother_id) {
    const { data: sibParentages } = await supabase
      .from("parentage")
      .select("child_id")
      .eq("father_id", parentage.father_id)
      .eq("mother_id", parentage.mother_id)
      .neq("child_id", personId);

    const sibIds = sibParentages?.map((p) => p.child_id) ?? [];
    if (sibIds.length > 0) {
      const { data: sibData } = await supabase.from("members").select("*").in("id", sibIds);
      siblings = sibData ?? [];
    }
  } else if (parentage?.mother_id && !parentage?.father_id) {
    // Seulement mère connue
    const { data: sibParentages } = await supabase
      .from("parentage")
      .select("child_id")
      .eq("mother_id", parentage.mother_id)
      .is("father_id", null)
      .neq("child_id", personId);

    const sibIds = sibParentages?.map((p) => p.child_id) ?? [];
    if (sibIds.length > 0) {
      const { data: sibData } = await supabase.from("members").select("*").in("id", sibIds);
      siblings = sibData ?? [];
    }
  } else if (parentage?.father_id && !parentage?.mother_id) {
    // Seulement père connu
    const { data: sibParentages } = await supabase
      .from("parentage")
      .select("child_id")
      .eq("father_id", parentage.father_id)
      .is("mother_id", null)
      .neq("child_id", personId);

    const sibIds = sibParentages?.map((p) => p.child_id) ?? [];
    if (sibIds.length > 0) {
      const { data: sibData } = await supabase.from("members").select("*").in("id", sibIds);
      siblings = sibData ?? [];
    }
  }

  // Union des parents
  let parentUnion = null;
  if (parentage?.father_id && parentage?.mother_id) {
    const { data } = await supabase
      .from("spouses")
      .select("*")
      .or(
        `and(member1_id.eq.${parentage.father_id},member2_id.eq.${parentage.mother_id}),` +
        `and(member1_id.eq.${parentage.mother_id},member2_id.eq.${parentage.father_id})`
      )
      .maybeSingle();
    parentUnion = data;
  }

  // ── Autres unions de la mère + leurs enfants (demi-frères) ─────
  // → chaque union supplémentaire affiche ses enfants SOUS son propre losange
  type ExtraUnion = {
    union: Record<string, unknown>;
    partner: Record<string, unknown>;
    children: Record<string, unknown>[];
  };
  const motherOtherUnions: ExtraUnion[] = [];

  if (parentage?.mother_id) {
    const motherId = parentage.mother_id;
    const { data: allMomUnions } = await supabase
      .from("spouses")
      .select("*")
      .or(`member1_id.eq.${motherId},member2_id.eq.${motherId}`);

    for (const u of (allMomUnions ?? [])) {
      const partnerId = u.member1_id === motherId ? u.member2_id : u.member1_id;
      // Exclure l'union avec le père (déjà affichée)
      if (parentage.father_id && partnerId === parentage.father_id) continue;

      const { data: partner } = await supabase
        .from("members").select("*").eq("id", partnerId).single();
      if (!partner) continue;

      // Enfants de CETTE union spécifique (mère + ce partenaire)
      const { data: childParentages } = await supabase
        .from("parentage")
        .select("child_id")
        .eq("mother_id", motherId)
        .eq("father_id", partnerId);

      const childIds = childParentages?.map((p) => p.child_id) ?? [];
      let children: Record<string, unknown>[] = [];
      if (childIds.length > 0) {
        const { data: childData } = await supabase.from("members").select("*").in("id", childIds);
        children = childData ?? [];
      }

      motherOtherUnions.push({ union: u, partner, children });
    }
  }

  // ── Propres unions de la personne (conjoint·e·s) ──────────────
  type OwnUnion = {
    union: Record<string, unknown>;
    partner: Record<string, unknown>;
  };
  const ownUnions: OwnUnion[] = [];
  const { data: ownSpousesData } = await supabase
    .from("spouses")
    .select("*")
    .or(`member1_id.eq.${personId},member2_id.eq.${personId}`);

  for (const u of (ownSpousesData ?? [])) {
    const partnerId = u.member1_id === personId ? u.member2_id : u.member1_id;
    const { data: partner } = await supabase
      .from("members").select("*").eq("id", partnerId).single();
    if (!partner) continue;
    ownUnions.push({ union: u, partner });
  }

  return NextResponse.json({ person, father, mother, siblings, parentUnion, motherOtherUnions, ownUnions });
}
