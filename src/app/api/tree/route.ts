import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get("person_id");
  const treeId   = searchParams.get("treeId");
  if (!personId) return NextResponse.json({ error: "person_id requis" }, { status: 400 });

  // La personne — father_id et mother_id sont maintenant des colonnes sur members
  let personQuery = supabase.from("members").select("*").eq("id", personId);
  if (treeId) personQuery = personQuery.eq("tree_id", treeId);

  const { data: person, error } = await personQuery.single();
  if (error) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });

  const fatherId = person.father_id as string | null;
  const motherId = person.mother_id as string | null;

  // Helper pour récupérer un membre (scoped au treeId si fourni)
  const getMember = async (id: string) => {
    let q = supabase.from("members").select("*").eq("id", id);
    if (treeId) q = q.eq("tree_id", treeId);
    const { data } = await q.single();
    return data;
  };

  // Père et mère
  let father = null;
  let mother = null;
  if (fatherId) father = await getMember(fatherId);
  if (motherId) mother = await getMember(motherId);

  // Frères/sœurs complets (même père ET mère, selon ce qui est connu)
  let siblings: unknown[] = [];
  if (fatherId || motherId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from("members").select("*").neq("id", personId);
    if (treeId) q = q.eq("tree_id", treeId);
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
  const motherOtherUnions: ExtraUnion[] = [];
  if (motherId) {
    const { data: motherSpouses } = await supabase
      .from("spouses")
      .select("*")
      .or(`member1_id.eq.${motherId},member2_id.eq.${motherId}`);

    for (const sp of (motherSpouses ?? [])) {
      const partnerId = sp.member1_id === motherId ? sp.member2_id : sp.member1_id;
      if (fatherId && partnerId === fatherId) continue;

      const partner = await getMember(partnerId);
      if (!partner) continue;

      let q = supabase.from("members").select("*")
        .or(
          `and(father_id.eq.${motherId},mother_id.eq.${partnerId}),` +
          `and(mother_id.eq.${motherId},father_id.eq.${partnerId})`
        );
      if (treeId) q = q.eq("tree_id", treeId);
      const { data: childData } = await q;
      const children = (childData ?? []).filter(
        (c) => !sibIds.has(c.id) && c.id !== personId
      );
      motherOtherUnions.push({ union: sp, partner, children });
    }

    let soloQ = supabase.from("members").select("*")
      .eq("mother_id", motherId).is("father_id", null).neq("id", personId);
    if (treeId) soloQ = soloQ.eq("tree_id", treeId);
    const { data: soloMotherData } = await soloQ;
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
      if (motherId && partnerId === motherId) continue;

      const partner = await getMember(partnerId);
      if (!partner) continue;

      let q = supabase.from("members").select("*")
        .or(
          `and(father_id.eq.${fatherId},mother_id.eq.${partnerId}),` +
          `and(mother_id.eq.${fatherId},father_id.eq.${partnerId})`
        );
      if (treeId) q = q.eq("tree_id", treeId);
      const { data: childData } = await q;
      const children = (childData ?? []).filter(
        (c) => !sibIds.has(c.id) && c.id !== personId
      );
      fatherOtherUnions.push({ union: sp, partner, children });
    }

    let soloQ = supabase.from("members").select("*")
      .eq("father_id", fatherId).is("mother_id", null).neq("id", personId);
    if (treeId) soloQ = soloQ.eq("tree_id", treeId);
    const { data: soloFatherData } = await soloQ;
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
    const partner = await getMember(partnerId);
    if (!partner) continue;

    let q = supabase.from("members").select("*")
      .or(
        `and(father_id.eq.${personId},mother_id.eq.${partnerId}),` +
        `and(mother_id.eq.${personId},father_id.eq.${partnerId})`
      );
    if (treeId) q = q.eq("tree_id", treeId);
    const { data: childData } = await q;

    ownUnions.push({ union: u, partner, children: childData ?? [] });
  }

  // Enfants nés sans autre parent enregistré (parent unique)
  let sfQ = supabase.from("members").select("*").eq("father_id", personId).is("mother_id", null);
  let smQ = supabase.from("members").select("*").eq("mother_id", personId).is("father_id", null);
  if (treeId) { sfQ = sfQ.eq("tree_id", treeId); smQ = smQ.eq("tree_id", treeId); }
  const [{ data: soloAsFather }, { data: soloAsMother }] = await Promise.all([sfQ, smQ]);
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
