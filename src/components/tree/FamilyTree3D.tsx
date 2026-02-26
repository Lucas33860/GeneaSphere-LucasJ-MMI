"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import * as THREE from "three";
import type { Member, Spouse } from "@/types";

// ── Types internes ────────────────────────────────────────────────
interface GraphPerson {
  id: string;
  member: Member;
  pos: [number, number, number];
  expanded: boolean;
}
interface GraphUnion {
  id: string;
  union: Spouse | null;
  pos: [number, number, number];
}
interface GraphEdge {
  id: string;
  from: [number, number, number];
  to: [number, number, number];
}

// Correspond exactement à la réponse de /api/tree
interface MotherOtherUnion {
  union: Spouse;
  partner: Member;
  children: Member[];
}
interface OwnUnionAPI {
  union: Spouse;
  partner: Member;
}
interface TreeData {
  person: Member;
  father: Member | null;
  mother: Member | null;
  siblings: Member[];
  parentUnion: Spouse | null;
  motherOtherUnions: MotherOtherUnion[];
  ownUnions: OwnUnionAPI[];
}

// ── Helpers visuels ───────────────────────────────────────────────
function nameToHex(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  const s = 0.65, l = 0.50;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function unionPicto(u: Spouse) {
  if (u.union_type === "couple") return u.separation_date ? "💔" : "♥";
  return u.separation_date ? "💍✗" : "💍";
}
function unionColor(u: Spouse) {
  if (u.union_type === "couple") return u.separation_date ? "#9ca3af" : "#ec4899";
  return u.separation_date ? "#6b7280" : "#d97706";
}

// ── Anti-collision ────────────────────────────────────────────────
const MIN_DIST    = 7;
const MIN_DIST_SQ = MIN_DIST * MIN_DIST;

function findFreePos(
  desired: [number, number, number],
  occupied: [number, number, number][],
): [number, number, number] {
  const conflicts = (p: [number, number, number]) =>
    occupied.some(e =>
      (p[0] - e[0]) ** 2 + (p[1] - e[1]) ** 2 + (p[2] - e[2]) ** 2 < MIN_DIST_SQ
    );
  if (!conflicts(desired)) return desired;

  for (let r = 1; r <= 16; r++) {
    const n = r * 8;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const candidate: [number, number, number] = [
        desired[0] + r * MIN_DIST * Math.cos(angle),
        desired[1],
        desired[2] + r * MIN_DIST * Math.sin(angle),
      ];
      if (!conflicts(candidate)) return candidate;
    }
  }
  return desired;
}

// ── PersonSphere ──────────────────────────────────────────────────
function PersonSphere({ node, onClick }: {
  node: GraphPerson;
  onClick: (n: GraphPerson) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color   = nameToHex(node.member.last_name);
  const isDead  = !!node.member.death_date;
  const fullName = `${node.member.first_name} ${node.member.last_name.toUpperCase()}`;

  useFrame(() => {
    if (!meshRef.current) return;
    const t = hovered ? 1.15 : 1;
    meshRef.current.scale.lerp(new THREE.Vector3(t, t, t), 0.1);
  });

  return (
    <group position={node.pos}>
      <mesh
        ref={meshRef}
        onClick={e => { e.stopPropagation(); onClick(node); }}
        onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
      >
        <sphereGeometry args={[0.9, 32, 32]} />
        <meshStandardMaterial color={color} opacity={isDead ? 0.5 : 1} transparent={isDead} roughness={0.35} metalness={0.15} />
      </mesh>

      <Text
        position={[0, 1.6, 0]}
        fontSize={0.7}
        color="white"
        outlineColor="#111827"
        outlineWidth={0.07}
        anchorX="center"
        anchorY="bottom"
        maxWidth={8}
        renderOrder={1}
      >
        {fullName}
      </Text>

      {isDead && (
        <Text position={[0, -1.3, 0]} fontSize={0.5} color="#9ca3af" outlineColor="#111827" outlineWidth={0.04} anchorX="center">
          † {node.member.death_date?.slice(0, 4)}
        </Text>
      )}
      {hovered && (
        <mesh>
          <sphereGeometry args={[1.08, 32, 32]} />
          <meshStandardMaterial color="white" transparent opacity={0.1} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// ── UnionSphere ───────────────────────────────────────────────────
function UnionSphere({ node }: { node: GraphUnion }) {
  const color = node.union ? unionColor(node.union) : "#9ca3af";
  const picto = node.union ? unionPicto(node.union) : "·";
  return (
    <group position={node.pos}>
      <mesh>
        <sphereGeometry args={[0.4, 24, 24]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} />
      </mesh>
      <Text position={[0, 0.8, 0]} fontSize={0.5} anchorX="center" renderOrder={1}>
        {picto}
      </Text>
    </group>
  );
}

// ── Edge ──────────────────────────────────────────────────────────
function Edge({ edge }: { edge: GraphEdge }) {
  return <Line points={[edge.from, edge.to]} color="#475569" lineWidth={1.5} />;
}

// ── Dashed Edge (demi-frères/sœurs) ──────────────────────────────
function DashedEdge({ edge }: { edge: GraphEdge }) {
  return <Line points={[edge.from, edge.to]} color="#94a3b8" lineWidth={1.2} dashed dashSize={0.5} gapSize={0.3} />;
}

// ── Camera focus (lerp vers la cible) ────────────────────────────
function CameraFocusController({ targetRef }: { targetRef: React.RefObject<THREE.Vector3 | null> }) {
  const { controls } = useThree();
  useFrame(() => {
    if (!targetRef.current || !controls) return;
    const ctrl = controls as unknown as { target: THREE.Vector3; update: () => void };
    ctrl.target.lerp(targetRef.current, 0.08);
    ctrl.update();
    if (ctrl.target.distanceTo(targetRef.current) < 0.05) targetRef.current = null;
  });
  return null;
}

// ── Camera reset ──────────────────────────────────────────────────
function CameraReset({ trigger }: { trigger: number }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    camera.position.set(4, 22, 32);
    camera.lookAt(0, 0, 0);
    const ctrl = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (ctrl) { ctrl.target.set(0, 0, 0); ctrl.update(); }
  }, [trigger, camera, controls]);
  return null;
}

// ── Props ─────────────────────────────────────────────────────────
interface FamilyTree3DProps {
  rootId: string;
  onSelectMember: (m: Member, union?: Spouse) => void;
}

// ── Composant principal ───────────────────────────────────────────
export function FamilyTree3D({ rootId, onSelectMember }: FamilyTree3DProps) {
  const [persons, setPersons] = useState<GraphPerson[]>([]);
  const [unions,  setUnions]  = useState<GraphUnion[]>([]);
  const [edges,   setEdges]   = useState<GraphEdge[]>([]);
  const [dashedEdges, setDashedEdges] = useState<GraphEdge[]>([]);
  const [cameraReset, setCameraReset] = useState(0);

  const expandedRef    = useRef<Set<string>>(new Set());
  const personIdsRef   = useRef<Set<string>>(new Set());
  const unionIdsRef    = useRef<Set<string>>(new Set());
  const edgeIdsRef     = useRef<Set<string>>(new Set());

  const occupiedPosRef = useRef<[number, number, number][]>([]);
  const personPosRef   = useRef<Map<string, [number, number, number]>>(new Map());
  const unionPosRef    = useRef<Map<string, [number, number, number]>>(new Map());

  const focusTargetRef = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    setPersons([]); setUnions([]); setEdges([]); setDashedEdges([]);
    expandedRef.current    = new Set();
    personIdsRef.current   = new Set();
    unionIdsRef.current    = new Set();
    edgeIdsRef.current     = new Set();
    occupiedPosRef.current = [];
    personPosRef.current   = new Map();
    unionPosRef.current    = new Map();
    setCameraReset(n => n + 1);
  }, [rootId]);

  const expandNode = useCallback(async (
    personId: string,
    basePos: [number, number, number],
  ) => {
    if (expandedRef.current.has(personId)) return;
    expandedRef.current.add(personId);

    const res = await fetch(`/api/tree?person_id=${personId}`);
    if (!res.ok) return;
    const data: TreeData = await res.json();

    const newPersons: GraphPerson[] = [];
    const newUnions:  GraphUnion[]  = [];
    const newEdges:   GraphEdge[]   = [];
    const newDashedEdges: GraphEdge[] = [];

    const addPerson = (m: Member, desired: [number, number, number]): [number, number, number] => {
      if (personIdsRef.current.has(m.id)) {
        return personPosRef.current.get(m.id) ?? desired;
      }
      personIdsRef.current.add(m.id);
      const actual = findFreePos(desired, occupiedPosRef.current);
      occupiedPosRef.current.push(actual);
      personPosRef.current.set(m.id, actual);
      newPersons.push({ id: m.id, member: m, pos: actual, expanded: false });
      return actual;
    };

    const addUnion = (
      id: string,
      union: Spouse | null,
      desiredPos: [number, number, number],
    ): [number, number, number] => {
      if (unionIdsRef.current.has(id)) {
        return unionPosRef.current.get(id) ?? desiredPos;
      }
      unionIdsRef.current.add(id);
      unionPosRef.current.set(id, desiredPos);
      newUnions.push({ id, union, pos: desiredPos });
      return desiredPos;
    };

    const addEdge = (id: string, from: [number, number, number], to: [number, number, number]) => {
      if (edgeIdsRef.current.has(id)) return;
      edgeIdsRef.current.add(id);
      newEdges.push({ id, from, to });
    };

    const addDashedEdge = (id: string, from: [number, number, number], to: [number, number, number]) => {
      if (edgeIdsRef.current.has(id)) return;
      edgeIdsRef.current.add(id);
      newDashedEdges.push({ id, from, to });
    };

    // ── Position réelle de la personne courante ───────────────────
    const selfPos: [number, number, number] = (() => {
      if (!personIdsRef.current.has(personId)) {
        personIdsRef.current.add(personId);
        const actual = findFreePos(basePos, occupiedPosRef.current);
        occupiedPosRef.current.push(actual);
        personPosRef.current.set(personId, actual);
        newPersons.push({ id: personId, member: data.person, pos: actual, expanded: true });
        return actual;
      }
      setPersons(prev => prev.map(p => p.id === personId ? { ...p, expanded: true } : p));
      return personPosRef.current.get(personId) ?? basePos;
    })();

    // ── Parents (Y +9, ±7 X) ─────────────────────────────────────
    const PARENT_Y = 9;
    const PARENT_X = 7;
    const UNION_Y  = 4.5;

    const confTest = (p: [number, number, number]) =>
      occupiedPosRef.current.some(
        e => (p[0]-e[0])**2 + (p[1]-e[1])**2 + (p[2]-e[2])**2 < MIN_DIST_SQ
      );

    const fNew = data.father && !personIdsRef.current.has(data.father.id);
    const mNew = data.mother && !personIdsRef.current.has(data.mother.id);

    let zShift = 0;
    if (fNew || mNew) {
      for (let i = 0; i <= 24; i++) {
        const z = i === 0 ? 0
          : (i % 2 === 1 ? Math.ceil(i / 2) : -Math.ceil(i / 2)) * MIN_DIST;
        const fOk = !fNew || !confTest([selfPos[0] - PARENT_X, selfPos[1] + PARENT_Y, selfPos[2] + z]);
        const mOk = !mNew || !confTest([selfPos[0] + PARENT_X, selfPos[1] + PARENT_Y, selfPos[2] + z]);
        if (fOk && mOk) { zShift = z; break; }
      }
    }

    const fatherDesired: [number, number, number] = [selfPos[0] - PARENT_X, selfPos[1] + PARENT_Y, selfPos[2] + zShift];
    const motherDesired: [number, number, number] = [selfPos[0] + PARENT_X, selfPos[1] + PARENT_Y, selfPos[2] + zShift];

    const actualFather = data.father ? addPerson(data.father, fatherDesired) : null;
    const actualMother = data.mother ? addPerson(data.mother, motherDesired) : null;

    const puid = data.parentUnion ? `u-${data.parentUnion.id}` : `pu-${personId}`;
    let actualParentUnionPos: [number, number, number] | null = null;

    if (actualFather && actualMother) {
      const unionPos: [number, number, number] = [
        (actualFather[0] + actualMother[0]) / 2,
        selfPos[1] + UNION_Y,
        (actualFather[2] + actualMother[2]) / 2,
      ];
      actualParentUnionPos = addUnion(puid, data.parentUnion, unionPos);
      addEdge(`e-f-${data.father!.id}-pu-${personId}`, actualFather, actualParentUnionPos);
      addEdge(`e-m-${data.mother!.id}-pu-${personId}`, actualMother, actualParentUnionPos);
      addEdge(`e-pu-${puid}-${personId}`, actualParentUnionPos, selfPos);
    } else if (actualFather) {
      addEdge(`e-single-f-${personId}`, actualFather, selfPos);
    } else if (actualMother) {
      addEdge(`e-single-m-${personId}`, actualMother, selfPos);
    }

    // ── Frères/sœurs complets (même père ET mère) ─────────────────
    data.siblings.forEach((sib, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const dist = Math.ceil((i + 1) / 2);
      const desired: [number, number, number] = [
        selfPos[0] - 9,
        selfPos[1],
        selfPos[2] + side * dist * 8,
      ];
      const actualSib = addPerson(sib, desired);
      const fromPos = actualParentUnionPos ?? selfPos;
      addEdge(`e-sib-${sib.id}-from-${personId}`, fromPos, actualSib);
    });

    // ── Demi-frères/sœurs via motherOtherUnions ───────────────────
    // L'API retourne les autres unions de la mère + leurs enfants
    const motherOtherUnions = data.motherOtherUnions ?? [];
    const knownChildIds = new Set<string>([personId]);
    data.siblings.forEach(s => knownChildIds.add(s.id));

    motherOtherUnions.forEach((mou, ouIdx) => {
      const otherUnionId = `u-${mou.union.id}`;

      // Ajouter le partenaire de la mère (l'autre conjoint)
      const otherPartnerDesired: [number, number, number] = [
        (actualMother ?? motherDesired)[0] + (ouIdx + 1) * 14,
        (actualMother ?? motherDesired)[1],
        (actualMother ?? motherDesired)[2] + (ouIdx + 1) * 8,
      ];
      const actualOtherPartner = addPerson(mou.partner, otherPartnerDesired);

      // Nœud union entre mère et ce partenaire
      const motherPos = actualMother ?? motherDesired;
      const otherUnionMid: [number, number, number] = [
        (motherPos[0] + actualOtherPartner[0]) / 2,
        motherPos[1],
        (motherPos[2] + actualOtherPartner[2]) / 2,
      ];
      const actualOtherUnionPos = addUnion(otherUnionId, mou.union, otherUnionMid);

      if (actualMother) {
        addEdge(`e-${otherUnionId}-mother`, actualMother, actualOtherUnionPos);
      }
      addEdge(`e-${otherUnionId}-partner`, actualOtherUnionPos, actualOtherPartner);

      // Enfants de cette union = demi-frères/sœurs
      const halfChildren = (mou.children ?? []).filter(c => !knownChildIds.has(c.id));
      halfChildren.forEach((halfChild, hci) => {
        knownChildIds.add(halfChild.id);
        const hSide = hci % 2 === 0 ? 1 : -1;
        const hDist = Math.ceil((hci + 1) / 2);
        const halfChildDesired: [number, number, number] = [
          actualOtherUnionPos[0],
          actualOtherUnionPos[1] - PARENT_Y,
          actualOtherUnionPos[2] + hSide * hDist * 8,
        ];
        const actualHalfChild = addPerson(halfChild, halfChildDesired);

        // Lien plein depuis l'union
        addEdge(
          `e-halfchild-${halfChild.id}-union-${mou.union.id}`,
          actualOtherUnionPos,
          actualHalfChild
        );

        // Lien pointillé entre la personne et son demi-frère/sœur
        addDashedEdge(
          `e-halfsib-${personId}-${halfChild.id}`,
          selfPos,
          actualHalfChild
        );
      });
    });

    // ── Demi-frères/sœurs côté père ──────────────────────────────
    // L'API ne fournit que motherOtherUnions, donc on fetch les données
    // du père pour trouver ses autres unions
    if (data.father && actualFather) {
      try {
        const fatherRes = await fetch(`/api/tree?person_id=${data.father.id}`);
        if (fatherRes.ok) {
          const fatherData: TreeData = await fatherRes.json();

          // Les "motherOtherUnions" du père = les autres unions de SA mère,
          // pas ce qu'on veut. On veut les propres unions du père (ownUnions)
          // autres que l'union parentale actuelle.
          const currentParentUnionId = data.parentUnion?.id;

          const fatherOtherUnions = fatherData.ownUnions.filter(
            ou => ou.union.id !== currentParentUnionId
          );

          fatherOtherUnions.forEach((fou, ouIdx) => {
            const otherUnionId = `u-${fou.union.id}`;

            // Ajouter le partenaire du père
            const otherPartnerDesired: [number, number, number] = [
              actualFather[0] - (ouIdx + 1) * 14,
              actualFather[1],
              actualFather[2] + (ouIdx + 1) * 8,
            ];
            const actualOtherPartner = addPerson(fou.partner, otherPartnerDesired);

            // Nœud union
            const otherUnionMid: [number, number, number] = [
              (actualFather[0] + actualOtherPartner[0]) / 2,
              actualFather[1],
              (actualFather[2] + actualOtherPartner[2]) / 2,
            ];
            const actualOtherUnionPos = addUnion(otherUnionId, fou.union, otherUnionMid);
            addEdge(`e-${otherUnionId}-father`, actualFather, actualOtherUnionPos);
            addEdge(`e-${otherUnionId}-partner`, actualOtherUnionPos, actualOtherPartner);

            // Fetch les enfants de cette union du père
            // L'API ownUnions ne retourne pas les enfants, donc on fetch
            // les données du partenaire pour trouver les enfants
            // OU on fetch l'arbre du partenaire pour obtenir ses enfants avec le père
            // Approche : fetch l'arbre de ce partenaire
            fetch(`/api/tree?person_id=${fou.partner.id}`)
              .then(r => r.ok ? r.json() : null)
              .then((partnerData: TreeData | null) => {
                if (!partnerData) return;

                // Les enfants communs père + partenaire sont dans les ownUnions
                // du partenaire, ou comme siblings du partenaire's children
                // Meilleure approche : chercher dans partnerData.ownUnions
                // l'union avec le père

                const sharedUnion = partnerData.ownUnions.find(
                  ou => ou.union.id === fou.union.id
                );
                // L'API ownUnions ne retourne pas les enfants non plus...
                // On va chercher les enfants via motherOtherUnions du partenaire
                // si le père est listé comme "autre union" de la mère du partenaire

                // Alternative plus simple : chercher directement dans
                // partnerData.motherOtherUnions ou partnerData.siblings
                // les enfants qui ont ce père

                // En fait, le plus efficace est de modifier l'API.
                // Pour l'instant, on affiche au moins l'union et le partenaire.
              })
              .catch(() => {});
          });
        }
      } catch {
        // Silencieux
      }
    }

    // ── Propres unions de la personne ─────────────────────────────
    const newOwnUnions = data.ownUnions.filter(
      ou => !unionIdsRef.current.has(`u-${ou.union.id}`)
    );
    const N          = newOwnUnions.length;
    const RADIUS     = 13;
    const TOTAL_ARC  = N <= 1 ? 0 : Math.min((N - 1) * 0.65, Math.PI * 0.75);

    newOwnUnions.forEach((ou, j) => {
      const unionId = `u-${ou.union.id}`;
      const angle   = N <= 1 ? 0 : -TOTAL_ARC / 2 + j * (TOTAL_ARC / (N - 1));

      const partnerDesired: [number, number, number] = [
        selfPos[0] + RADIUS * Math.cos(angle),
        selfPos[1],
        selfPos[2] + RADIUS * Math.sin(angle),
      ];
      const actualPartner = addPerson(ou.partner, partnerDesired);

      const midPos: [number, number, number] = [
        (selfPos[0] + actualPartner[0]) / 2,
        selfPos[1],
        (selfPos[2] + actualPartner[2]) / 2,
      ];
      const actualUnionPos = addUnion(unionId, ou.union, midPos);
      addEdge(`e-${unionId}-self`,    selfPos,          actualUnionPos);
      addEdge(`e-${unionId}-partner`, actualUnionPos,   actualPartner);
    });

    // ── Unions existantes : pas d'enfants dans ownUnions de l'API actuelle
    // (l'API retourne { union, partner } sans children dans ownUnions)

    if (newPersons.length > 0) setPersons(prev => [...prev, ...newPersons]);
    if (newUnions.length  > 0) setUnions(prev  => [...prev, ...newUnions]);
    if (newEdges.length   > 0) setEdges(prev   => [...prev, ...newEdges]);
    if (newDashedEdges.length > 0) setDashedEdges(prev => [...prev, ...newDashedEdges]);
  }, []);

  useEffect(() => {
    if (!rootId) return;
    expandNode(rootId, [0, 0, 0]);
  }, [rootId, expandNode]);

  const handleClickPerson = useCallback((node: GraphPerson) => {
    onSelectMember(node.member);
    focusTargetRef.current = new THREE.Vector3(...node.pos);
    expandNode(node.id, node.pos);
  }, [onSelectMember, expandNode]);

  return (
    <Canvas
      camera={{ position: [4, 22, 32], fov: 60 }}
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
    >
      <CameraReset trigger={cameraReset} />
      <CameraFocusController targetRef={focusTargetRef} />

      <ambientLight intensity={0.6} />
      <pointLight position={[15, 15, 15]} intensity={1.2} />
      <pointLight position={[-15, -10, -10]} intensity={0.4} />
      <pointLight position={[0, -20, 5]} intensity={0.3} color="#6366f1" />

      <OrbitControls makeDefault enableDamping dampingFactor={0.06} />

      {edges.map(e        => <Edge        key={e.id} edge={e} />)}
      {dashedEdges.map(e  => <DashedEdge  key={e.id} edge={e} />)}
      {unions.map(u       => <UnionSphere key={u.id} node={u} />)}
      {persons.map(p      => <PersonSphere key={p.id} node={p} onClick={handleClickPerson} />)}
    </Canvas>
  );
}
