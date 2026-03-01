"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line, Billboard } from "@react-three/drei";
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
  union: Spouse | null;    // null = enfant de parent seul (pas d'union enregistrée)
  partner: Member | null;  // null = même raison
  children: Member[];
}
interface OwnUnionAPI {
  union: Spouse;
  partner: Member;
  children: Member[];
}
interface TreeData {
  person: Member;
  father: Member | null;
  mother: Member | null;
  siblings: Member[];
  parentUnion: Spouse | null;
  motherOtherUnions: MotherOtherUnion[];
  fatherOtherUnions: MotherOtherUnion[];
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

      <Billboard>
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
      </Billboard>
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
      <Billboard>
        <Text position={[0, 0.8, 0]} fontSize={0.5} anchorX="center" renderOrder={1}>
          {picto}
        </Text>
      </Billboard>
    </group>
  );
}

// ── Edge ──────────────────────────────────────────────────────────
function Edge({ edge }: { edge: GraphEdge }) {
  return <Line points={[edge.from, edge.to]} color="#475569" lineWidth={1.5} />;
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
    setPersons([]); setUnions([]); setEdges([]);
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
      const motherPos = actualMother ?? motherDesired;
      const halfChildren = (mou.children ?? []).filter(c => !knownChildIds.has(c.id));

      // ── Cas parent seul : pas de partenaire ni d'union ───────────
      if (!mou.partner) {
        halfChildren.forEach((halfChild, hci) => {
          knownChildIds.add(halfChild.id);
          const hSide = hci % 2 === 0 ? 1 : -1;
          const hDist = Math.ceil((hci + 1) / 2);
          const desired: [number, number, number] = [
            motherPos[0] + (ouIdx + 1) * 10,
            motherPos[1] - PARENT_Y,
            motherPos[2] + hSide * hDist * 8,
          ];
          const actualHalfChild = addPerson(halfChild, desired);
          if (actualMother) addEdge(`e-alone-m-${halfChild.id}`, actualMother, actualHalfChild);
        });
        return;
      }

      // ── Cas normal : partenaire + union ──────────────────────────
      const otherUnionId = `u-${mou.union!.id}`;
      const mSide = ouIdx % 2 === 0 ? 1 : -1; // alternance gauche/droite
      const otherPartnerDesired: [number, number, number] = [
        motherPos[0] + mSide * (ouIdx + 1) * 14,
        motherPos[1],
        motherPos[2] + (ouIdx + 1) * 8,
      ];
      const actualOtherPartner = addPerson(mou.partner, otherPartnerDesired);

      const otherUnionMid: [number, number, number] = [
        (motherPos[0] + actualOtherPartner[0]) / 2,
        motherPos[1] - UNION_Y, // en dessous des deux → forme un V
        (motherPos[2] + actualOtherPartner[2]) / 2,
      ];
      const actualOtherUnionPos = addUnion(otherUnionId, mou.union, otherUnionMid);
      if (actualMother) addEdge(`e-${otherUnionId}-mother`, actualMother, actualOtherUnionPos);
      addEdge(`e-${otherUnionId}-partner`, actualOtherUnionPos, actualOtherPartner);

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
        addEdge(`e-halfchild-${halfChild.id}-union-${mou.union!.id}`, actualOtherUnionPos, actualHalfChild);
      });
    });

    // ── Demi-frères/sœurs côté père via fatherOtherUnions ───────────
    const fatherOtherUnions = data.fatherOtherUnions ?? [];
    fatherOtherUnions.forEach((fou, ouIdx) => {
      const fPos = actualFather ?? fatherDesired;
      const fatherHalfChildren = (fou.children ?? []).filter(c => !knownChildIds.has(c.id));

      // ── Cas parent seul : pas de partenaire ──────────────────────
      if (!fou.partner) {
        fatherHalfChildren.forEach((halfChild, hci) => {
          knownChildIds.add(halfChild.id);
          const hSide = hci % 2 === 0 ? 1 : -1;
          const hDist = Math.ceil((hci + 1) / 2);
          const desired: [number, number, number] = [
            fPos[0] - (ouIdx + 1) * 10,
            fPos[1] - PARENT_Y,
            fPos[2] + hSide * hDist * 8,
          ];
          const actualHalfChild = addPerson(halfChild, desired);
          if (actualFather) addEdge(`e-alone-f-${halfChild.id}`, actualFather, actualHalfChild);
        });
        return;
      }

      // ── Cas normal : partenaire + union ──────────────────────────
      const otherUnionId = `u-${fou.union!.id}`;
      const fSide = ouIdx % 2 === 0 ? -1 : 1; // alternance gauche/droite
      const otherPartnerDesired: [number, number, number] = [
        fPos[0] + fSide * (ouIdx + 1) * 14,
        fPos[1],
        fPos[2] + (ouIdx + 1) * 8,
      ];
      const actualOtherPartner = addPerson(fou.partner, otherPartnerDesired);

      const otherUnionMid: [number, number, number] = [
        (fPos[0] + actualOtherPartner[0]) / 2,
        fPos[1] - UNION_Y, // en dessous des deux → forme un V
        (fPos[2] + actualOtherPartner[2]) / 2,
      ];
      const actualOtherUnionPos = addUnion(otherUnionId, fou.union, otherUnionMid);
      if (actualFather) addEdge(`e-${otherUnionId}-father`, actualFather, actualOtherUnionPos);
      addEdge(`e-${otherUnionId}-fpartner`, actualOtherUnionPos, actualOtherPartner);

      fatherHalfChildren.forEach((halfChild, hci) => {
        knownChildIds.add(halfChild.id);
        const hSide = hci % 2 === 0 ? 1 : -1;
        const hDist = Math.ceil((hci + 1) / 2);
        const halfChildDesired: [number, number, number] = [
          actualOtherUnionPos[0],
          actualOtherUnionPos[1] - PARENT_Y,
          actualOtherUnionPos[2] + hSide * hDist * 8,
        ];
        const actualHalfChild = addPerson(halfChild, halfChildDesired);
        addEdge(`e-halfchild-f-${halfChild.id}-u-${fou.union!.id}`, actualOtherUnionPos, actualHalfChild);
      });
    });

    // ── Propres unions — V vers le bas, enfants encore plus bas ──────
    // Forme : self \  / partner
    //              \/
    //           union node
    //           /   \
    //        enfant enfant
    const newOwnUnions = data.ownUnions.filter(
      ou => !unionIdsRef.current.has(`u-${ou.union.id}`)
    );
    const RADIUS = 13;
    const N = newOwnUnions.length;

    newOwnUnions.forEach((ou, j) => {
      const unionId = `u-${ou.union.id}`;
      // Répartition uniforme en cercle : N=1→droite, N=2→gauche/droite, N=3→triangle, etc.
      const angle = (2 * Math.PI / Math.max(N, 1)) * j;

      const partnerDesired: [number, number, number] = [
        selfPos[0] + RADIUS * Math.cos(angle),
        selfPos[1],
        selfPos[2] + RADIUS * Math.sin(angle),
      ];
      const actualPartner = addPerson(ou.partner, partnerDesired);

      // Nœud d'union EN DESSOUS des deux → forme un V
      const unionPos: [number, number, number] = [
        (selfPos[0] + actualPartner[0]) / 2,
        selfPos[1] - UNION_Y,
        (selfPos[2] + actualPartner[2]) / 2,
      ];
      const actualUnionPos = addUnion(unionId, ou.union, unionPos);
      addEdge(`e-${unionId}-self`,    selfPos,       actualUnionPos);
      addEdge(`e-${unionId}-partner`, actualPartner, actualUnionPos);

      // Enfants de cette union, une génération plus bas
      (ou.children ?? []).forEach((child, k) => {
        const kSide = k % 2 === 0 ? 1 : -1;
        const kDist = Math.ceil((k + 1) / 2);
        const childDesired: [number, number, number] = [
          actualUnionPos[0],
          selfPos[1] - PARENT_Y,
          actualUnionPos[2] + kSide * kDist * 8,
        ];
        const actualChild = addPerson(child, childDesired);
        addEdge(`e-child-${child.id}-${unionId}`, actualUnionPos, actualChild);
      });
    });

    if (newPersons.length > 0) setPersons(prev => [...prev, ...newPersons]);
    if (newUnions.length  > 0) setUnions(prev  => [...prev, ...newUnions]);
    if (newEdges.length   > 0) setEdges(prev   => [...prev, ...newEdges]);
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

      {edges.map(e   => <Edge        key={e.id} edge={e} />)}
      {unions.map(u  => <UnionSphere key={u.id} node={u} />)}
      {persons.map(p      => <PersonSphere key={p.id} node={p} onClick={handleClickPerson} />)}
    </Canvas>
  );
}
