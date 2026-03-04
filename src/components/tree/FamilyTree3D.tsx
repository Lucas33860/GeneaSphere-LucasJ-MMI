"use client";

import { useEffect, useRef, useState, useCallback, memo, Component, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line, Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { Member, Spouse } from "@/types";

// ── ErrorBoundary pour le canvas WebGL ────────────────────────────
class CanvasErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
        <p className="text-4xl">⚠️</p>
        <p className="text-white font-semibold">Erreur de rendu 3D</p>
        <p className="text-slate-400 text-sm">Votre appareil ne supporte peut-être pas WebGL.</p>
        <button onClick={() => this.setState({ error: null })} className="text-indigo-400 text-sm underline">Réessayer</button>
      </div>
    );
    return this.props.children;
  }
}

// ── Types internes ────────────────────────────────────────────────
interface GraphPerson {
  id: string;
  member: Member;
  pos: [number, number, number];
  expanded: boolean;
  birthTime: number;
}
interface GraphUnion {
  id: string;
  union: Spouse | null;
  pos: [number, number, number];
  birthTime: number;
}
interface GraphEdge {
  id: string;
  from: [number, number, number];
  to: [number, number, number];
  unId?: string; // graph union node ID this edge belongs to
}
export interface NavEntry {
  id: string;
  label: string;
  time: number;
  persons: GraphPerson[];
  unions: GraphUnion[];
  edges: GraphEdge[];
  expanded: string[];
}

// Correspond exactement à la réponse de /api/tree
interface MotherOtherUnion {
  union: Spouse | null;    // null = enfant de parent seul (pas d'union enregistrée)
  partner: Member | null;  // null = même raison
  children: Member[];
}
interface OwnUnionAPI {
  union: Spouse | null;   // null = enfant de parent unique
  partner: Member | null; // null = même raison
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
const MIN_DIST    = 12;
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
const PersonSphere = memo(function PersonSphere({ node, onClick }: {
  node: GraphPerson;
  onClick: (n: GraphPerson) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color    = nameToHex(node.member.last_name ?? "");
  const isDead   = !!node.member.death_date;
  const fullName = `${node.member.first_name ?? ""} ${(node.member.last_name ?? "").toUpperCase()}`;

  useFrame(() => {
    if (!meshRef.current) return;
    const elapsed = (Date.now() - node.birthTime) / 900;
    const s = Math.min(elapsed, 1);
    const eased = s < 0.5 ? 2 * s * s : -1 + (4 - 2 * s) * s;
    const target = (hovered ? 1.15 : 1) * eased;
    meshRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.10);
  });

  return (
    <group position={node.pos}>
      <mesh
        ref={meshRef}
        onClick={e => { e.stopPropagation(); onClick(node); }}
        onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
      >
        <sphereGeometry args={[0.9, 14, 14]} />
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
          <sphereGeometry args={[1.08, 14, 14]} />
          <meshStandardMaterial color="white" transparent opacity={0.1} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
});

// ── UnionSphere ───────────────────────────────────────────────────
const UnionSphere = memo(function UnionSphere({ node, onClick, selected }: { node: GraphUnion; onClick?: (u: Spouse, nodeId: string) => void; selected: boolean }) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const color = node.union ? unionColor(node.union) : "#9ca3af";
  const picto = node.union ? unionPicto(node.union) : "·";
  const clickable = !!node.union;

  useFrame(() => {
    if (!meshRef.current) return;
    const elapsed = (Date.now() - node.birthTime) / 900;
    const s = Math.min(elapsed, 1);
    const eased = s < 0.5 ? 2 * s * s : -1 + (4 - 2 * s) * s;
    const target = (hovered ? 1.3 : 1) * eased;
    meshRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.10);
  });

  return (
    <group position={node.pos}>
      <mesh
        ref={meshRef}
        onClick={clickable ? (e => { e.stopPropagation(); onClick?.(node.union!, node.id); }) : undefined}
        onPointerOver={clickable ? (e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }) : undefined}
        onPointerOut={clickable ? (() => { setHovered(false); document.body.style.cursor = "default"; }) : undefined}
      >
        <sphereGeometry args={[0.4, 10, 10]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} emissive={selected ? "#ffffff" : hovered ? color : "#000000"} emissiveIntensity={selected ? 0.6 : hovered ? 0.4 : 0} />
      </mesh>
      {selected && (
        <mesh>
          <sphereGeometry args={[0.72, 10, 10]} />
          <meshStandardMaterial color="#a78bfa" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
      <Billboard>
        <Text position={[0, 0.8, 0]} fontSize={0.5} anchorX="center" renderOrder={1}>
          {picto}
        </Text>
      </Billboard>
    </group>
  );
});

// ── Edge ──────────────────────────────────────────────────────────
const Edge = memo(function Edge({ edge, highlighted }: { edge: GraphEdge; highlighted: boolean }) {
  return <Line points={[edge.from, edge.to]} color={highlighted ? "#a78bfa" : "#475569"} lineWidth={highlighted ? 3.5 : 1.5} />;
});


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

// ── CameraPresetController ────────────────────────────────────────
export type ViewMode = "free" | "top" | "front" | "side";

function CameraPresetController({ mode }: { mode: ViewMode }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    const ctrl = controls as unknown as {
      target: THREE.Vector3; update: () => void;
      minPolarAngle: number; maxPolarAngle: number;
      minAzimuthAngle: number; maxAzimuthAngle: number;
      enableRotate: boolean;
      mouseButtons: { LEFT: number; MIDDLE: number; RIGHT: number };
    };
    if (!ctrl) return;
    const t = ctrl.target.clone();
    const dist = Math.max(camera.position.distanceTo(ctrl.target), 45);

    if (mode === "top") {
      camera.position.set(t.x, t.y + dist, t.z + 0.001);
      ctrl.minPolarAngle = ctrl.maxPolarAngle = 0;
      ctrl.minAzimuthAngle = -Infinity; ctrl.maxAzimuthAngle = Infinity;
      ctrl.enableRotate = false;
    } else if (mode === "front") {
      camera.position.set(t.x, t.y, t.z + dist);
      ctrl.minPolarAngle = ctrl.maxPolarAngle = Math.PI / 2;
      ctrl.minAzimuthAngle = -Infinity; ctrl.maxAzimuthAngle = Infinity;
      ctrl.enableRotate = false;
    } else if (mode === "side") {
      camera.position.set(t.x + dist, t.y, t.z);
      ctrl.minPolarAngle = ctrl.maxPolarAngle = Math.PI / 2;
      ctrl.minAzimuthAngle = -Infinity; ctrl.maxAzimuthAngle = Infinity;
      ctrl.enableRotate = false;
    } else {
      ctrl.minPolarAngle = 0; ctrl.maxPolarAngle = Math.PI;
      ctrl.minAzimuthAngle = -Infinity; ctrl.maxAzimuthAngle = Infinity;
      ctrl.enableRotate = true;
    }

    // En mode verrouillé : clic gauche = pan (déplacement dans le plan de la vue)
    // En mode libre : clic gauche = rotation (comportement par défaut)
    const locked = mode !== "free";
    ctrl.mouseButtons = {
      LEFT:   locked ? THREE.MOUSE.PAN    : THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT:  THREE.MOUSE.PAN,
    };

    ctrl.update();
  }, [mode, camera, controls]);
  return null;
}

// ── Props ─────────────────────────────────────────────────────────
interface FamilyTree3DProps {
  rootId: string;
  resetKey?: number;
  viewMode?: ViewMode;
  showHistory?: boolean;
  treeId?: string;
  onSelectMember: (m: Member) => void;
  onSelectUnion?: (u: Spouse) => void;
}

// ── Composant principal ───────────────────────────────────────────
export function FamilyTree3D({ rootId, resetKey, viewMode = "free", showHistory = false, treeId, onSelectMember, onSelectUnion }: FamilyTree3DProps) {
  const [persons, setPersons] = useState<GraphPerson[]>([]);
  const [unions,  setUnions]  = useState<GraphUnion[]>([]);
  const [edges,   setEdges]   = useState<GraphEdge[]>([]);
  const [cameraReset, setCameraReset]       = useState(0);
  const [autoRotate, setAutoRotate]         = useState(true);
  const [selectedUnionId, setSelectedUnionId] = useState<string | null>(null);

  const expandedRef    = useRef<Set<string>>(new Set());
  const personIdsRef   = useRef<Set<string>>(new Set());
  const unionIdsRef    = useRef<Set<string>>(new Set());
  const edgeIdsRef     = useRef<Set<string>>(new Set());

  const occupiedPosRef = useRef<[number, number, number][]>([]);
  const personPosRef   = useRef<Map<string, [number, number, number]>>(new Map());
  const unionPosRef    = useRef<Map<string, [number, number, number]>>(new Map());

  const focusTargetRef = useRef<THREE.Vector3 | null>(null);

  // Miroirs synchrones des états React (lecture sans stale closure)
  const personsRef = useRef<GraphPerson[]>([]);
  const unionsRef  = useRef<GraphUnion[]>([]);
  const edgesRef   = useRef<GraphEdge[]>([]);

  // Annulation des timeouts pendants lors d'un reset
  const pendingTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Historique navigation (Ctrl+Z + panneau visuel)
  const navHistoryRef = useRef<NavEntry[]>([]);
  const [navEntries, setNavEntries] = useState<NavEntry[]>([]);

  useEffect(() => {
    // Annuler tous les timeouts en cours pour éviter les doublons
    pendingTimeoutsRef.current.forEach(clearTimeout);
    pendingTimeoutsRef.current = [];

    setPersons([]); setUnions([]); setEdges([]);
    personsRef.current = []; unionsRef.current = []; edgesRef.current = [];
    navHistoryRef.current = [];
    setNavEntries([]);
    expandedRef.current    = new Set();
    personIdsRef.current   = new Set();
    unionIdsRef.current    = new Set();
    edgeIdsRef.current     = new Set();
    occupiedPosRef.current = [];
    personPosRef.current   = new Map();
    unionPosRef.current    = new Map();
    setCameraReset(n => n + 1);
    setAutoRotate(true);
    const t = setTimeout(() => setAutoRotate(false), 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId, resetKey]);

  // Garder les refs synchronisées
  useEffect(() => { personsRef.current = persons; }, [persons]);
  useEffect(() => { unionsRef.current  = unions;  }, [unions]);
  useEffect(() => { edgesRef.current   = edges;   }, [edges]);

  const expandNode = useCallback(async (
    personId: string,
    basePos: [number, number, number],
  ) => {
    if (expandedRef.current.has(personId)) return;
    expandedRef.current.add(personId);

    const res = await fetch(`/api/tree?person_id=${personId}${treeId ? `&treeId=${treeId}` : ""}`);
    if (!res.ok) return;
    const data: TreeData = await res.json();

    // Sauvegarder l'état AVANT l'expansion (on a le nom maintenant)
    const navEntry: NavEntry = {
      id: `${personId}-${Date.now()}`,
      label: `${data.person.first_name} ${data.person.last_name.toUpperCase()}`,
      time: Date.now(),
      persons: [...personsRef.current],
      unions:  [...unionsRef.current],
      edges:   [...edgesRef.current],
      expanded: [...expandedRef.current].filter(id => id !== personId),
    };
    navHistoryRef.current = [...navHistoryRef.current, navEntry];
    if (navHistoryRef.current.length > 25) navHistoryRef.current.shift();
    setNavEntries([...navHistoryRef.current]);

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
      newPersons.push({ id: m.id, member: m, pos: actual, expanded: false, birthTime: Date.now() });
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
      newUnions.push({ id, union, pos: desiredPos, birthTime: Date.now() });
      return desiredPos;
    };

    const addEdge = (id: string, from: [number, number, number], to: [number, number, number], unId?: string) => {
      if (edgeIdsRef.current.has(id)) return;
      edgeIdsRef.current.add(id);
      newEdges.push({ id, from, to, unId });
    };

    // ── Position réelle de la personne courante ───────────────────
    const selfPos: [number, number, number] = (() => {
      if (!personIdsRef.current.has(personId)) {
        personIdsRef.current.add(personId);
        const actual = findFreePos(basePos, occupiedPosRef.current);
        occupiedPosRef.current.push(actual);
        personPosRef.current.set(personId, actual);
        newPersons.push({ id: personId, member: data.person, pos: actual, expanded: true, birthTime: Date.now() });
        return actual;
      }
      setPersons(prev => prev.map(p => p.id === personId ? { ...p, expanded: true } : p));
      return personPosRef.current.get(personId) ?? basePos;
    })();

    // ── Constantes de placement ───────────────────────────────────
    const PARENT_Y = 16;
    const PARENT_X = 12;
    const UNION_Y  = 8;
    const RADIUS   = 22;

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
      addEdge(`e-f-${data.father!.id}-pu-${personId}`, actualFather, actualParentUnionPos, puid);
      addEdge(`e-m-${data.mother!.id}-pu-${personId}`, actualMother, actualParentUnionPos, puid);
      addEdge(`e-pu-${puid}-${personId}`, actualParentUnionPos, selfPos, puid);
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
      addEdge(`e-sib-${sib.id}-from-${personId}`, fromPos, actualSib, actualParentUnionPos ? puid : undefined);
    });

    // ── Demi-frères/sœurs via motherOtherUnions ───────────────────
    const motherOtherUnions = data.motherOtherUnions ?? [];
    const knownChildIds = new Set<string>([personId]);
    data.siblings.forEach(s => knownChildIds.add(s.id));

    // N_total inclut l'union parent → 3 unions = triangle équilatéral (120° d'écart)
    const mouPartnered = motherOtherUnions.filter(mou => mou.partner !== null).length;
    const hasBothParents = !!(actualFather && actualMother);
    const N_total_mou = mouPartnered + (hasBothParents ? 1 : 0);
    const mou_startAngle = (N_total_mou % 2 === 1 && N_total_mou > 1) ? Math.PI / 2 : 0;

    // Trouver le slot le plus proche de la direction mère→père
    let parentSlot_mou = -1;
    if (hasBothParents && N_total_mou > 1 && actualFather && actualMother) {
      const dx = actualFather[0] - actualMother[0];
      const dz = actualFather[2] - actualMother[2];
      const parentDir = Math.atan2(dz, dx);
      let minDiff = Infinity;
      for (let i = 0; i < N_total_mou; i++) {
        const slotAngle = mou_startAngle + (2 * Math.PI / N_total_mou) * i;
        const diff = Math.abs(Math.atan2(Math.sin(parentDir - slotAngle), Math.cos(parentDir - slotAngle)));
        if (diff < minDiff) { minDiff = diff; parentSlot_mou = i; }
      }
    }

    // Slots restants pour les autres unions (tout sauf le slot du père)
    const mou_slots = Array.from({ length: N_total_mou }, (_, i) => i)
      .filter(i => i !== parentSlot_mou);
    let mou_circleIdx = 0;

    motherOtherUnions.forEach((mou) => {
      const motherPos = actualMother ?? motherDesired;
      const halfChildren = (mou.children ?? []).filter(c => !knownChildIds.has(c.id));

      // ── Cas parent seul : pas de partenaire ni d'union ───────────
      if (!mou.partner) {
        const sibOffset = data.siblings.length;
        halfChildren.forEach((halfChild, hci) => {
          knownChildIds.add(halfChild.id);
          const hSide = hci % 2 === 0 ? 1 : -1;
          const hDist = Math.ceil((hci + 1) / 2);
          const desired: [number, number, number] = [
            selfPos[0] - 9,
            selfPos[1],
            selfPos[2] + hSide * (sibOffset + hDist) * 8,
          ];
          const actualHalfChild = addPerson(halfChild, desired);
          if (actualMother) addEdge(`e-alone-m-${halfChild.id}`, actualMother, actualHalfChild);
        });
        return;
      }

      // ── Cas normal : slot du triangle (excluant le slot père) ────
      const otherUnionId = mou.union ? `u-${mou.union.id}` : `mou-partner-${mou.partner!.id}`;
      const slotIdx = mou_slots[mou_circleIdx] ?? mou_circleIdx;
      const angle = mou_startAngle + (2 * Math.PI / Math.max(N_total_mou, 1)) * slotIdx;
      mou_circleIdx++;

      const otherPartnerDesired: [number, number, number] = [
        motherPos[0] + RADIUS * Math.cos(angle),
        motherPos[1],
        motherPos[2] + RADIUS * Math.sin(angle),
      ];
      const actualOtherPartner = addPerson(mou.partner, otherPartnerDesired);

      const otherUnionMid: [number, number, number] = [
        (motherPos[0] + actualOtherPartner[0]) / 2,
        motherPos[1] - UNION_Y,
        (motherPos[2] + actualOtherPartner[2]) / 2,
      ];
      const actualOtherUnionPos = addUnion(otherUnionId, mou.union, otherUnionMid);
      if (actualMother) addEdge(`e-${otherUnionId}-mother`, actualMother, actualOtherUnionPos, otherUnionId);
      addEdge(`e-${otherUnionId}-partner`, actualOtherUnionPos, actualOtherPartner, otherUnionId);

      halfChildren.forEach((halfChild, hci) => {
        knownChildIds.add(halfChild.id);
        const hSide = hci % 2 === 0 ? 1 : -1;
        const hDist = Math.ceil((hci + 1) / 2);
        const halfChildDesired: [number, number, number] = [
          actualOtherUnionPos[0],
          selfPos[1],
          actualOtherUnionPos[2] + hSide * hDist * 8,
        ];
        const actualHalfChild = addPerson(halfChild, halfChildDesired);
        addEdge(`e-halfchild-${halfChild.id}-union-${mou.union!.id}`, actualOtherUnionPos, actualHalfChild, otherUnionId);
      });
    });

    // ── Demi-frères/sœurs côté père via fatherOtherUnions ───────────
    const fatherOtherUnions = data.fatherOtherUnions ?? [];

    // N_total inclut l'union parent → triangle équilatéral cohérent
    const fouPartnered = fatherOtherUnions.filter(fou => fou.partner !== null).length;
    const N_total_fou = fouPartnered + (hasBothParents ? 1 : 0);
    const fou_startAngle = (N_total_fou % 2 === 1 && N_total_fou > 1) ? Math.PI / 2 : 0;

    // Trouver le slot le plus proche de la direction père→mère
    let parentSlot_fou = -1;
    if (hasBothParents && N_total_fou > 1 && actualFather && actualMother) {
      const dx = actualMother[0] - actualFather[0];
      const dz = actualMother[2] - actualFather[2];
      const parentDir = Math.atan2(dz, dx);
      let minDiff = Infinity;
      for (let i = 0; i < N_total_fou; i++) {
        const slotAngle = fou_startAngle + (2 * Math.PI / N_total_fou) * i;
        const diff = Math.abs(Math.atan2(Math.sin(parentDir - slotAngle), Math.cos(parentDir - slotAngle)));
        if (diff < minDiff) { minDiff = diff; parentSlot_fou = i; }
      }
    }

    const fou_slots = Array.from({ length: N_total_fou }, (_, i) => i)
      .filter(i => i !== parentSlot_fou);
    let fou_circleIdx = 0;

    fatherOtherUnions.forEach((fou) => {
      const fPos = actualFather ?? fatherDesired;
      const fatherHalfChildren = (fou.children ?? []).filter(c => !knownChildIds.has(c.id));

      // ── Cas parent seul : pas de partenaire ──────────────────────
      if (!fou.partner) {
        const sibOffset = data.siblings.length;
        fatherHalfChildren.forEach((halfChild, hci) => {
          knownChildIds.add(halfChild.id);
          const hSide = hci % 2 === 0 ? 1 : -1;
          const hDist = Math.ceil((hci + 1) / 2);
          const desired: [number, number, number] = [
            selfPos[0] - 9,
            selfPos[1],
            selfPos[2] + hSide * (sibOffset + hDist) * 8,
          ];
          const actualHalfChild = addPerson(halfChild, desired);
          if (actualFather) addEdge(`e-alone-f-${halfChild.id}`, actualFather, actualHalfChild);
        });
        return;
      }

      // ── Cas normal : slot du triangle (excluant le slot mère) ────
      const otherUnionId = fou.union ? `u-${fou.union.id}` : `fou-partner-${fou.partner!.id}`;
      const slotIdx = fou_slots[fou_circleIdx] ?? fou_circleIdx;
      const angle = fou_startAngle + (2 * Math.PI / Math.max(N_total_fou, 1)) * slotIdx;
      fou_circleIdx++;

      const otherPartnerDesired: [number, number, number] = [
        fPos[0] + RADIUS * Math.cos(angle),
        fPos[1],
        fPos[2] + RADIUS * Math.sin(angle),
      ];
      const actualOtherPartner = addPerson(fou.partner, otherPartnerDesired);

      const otherUnionMid: [number, number, number] = [
        (fPos[0] + actualOtherPartner[0]) / 2,
        fPos[1] - UNION_Y,
        (fPos[2] + actualOtherPartner[2]) / 2,
      ];
      const actualOtherUnionPos = addUnion(otherUnionId, fou.union, otherUnionMid);
      if (actualFather) addEdge(`e-${otherUnionId}-father`, actualFather, actualOtherUnionPos, otherUnionId);
      addEdge(`e-${otherUnionId}-fpartner`, actualOtherUnionPos, actualOtherPartner, otherUnionId);

      fatherHalfChildren.forEach((halfChild, hci) => {
        knownChildIds.add(halfChild.id);
        const hSide = hci % 2 === 0 ? 1 : -1;
        const hDist = Math.ceil((hci + 1) / 2);
        const halfChildDesired: [number, number, number] = [
          actualOtherUnionPos[0],
          selfPos[1],
          actualOtherUnionPos[2] + hSide * hDist * 8,
        ];
        const actualHalfChild = addPerson(halfChild, halfChildDesired);
        addEdge(`e-halfchild-f-${halfChild.id}-u-${fou.union!.id}`, actualOtherUnionPos, actualHalfChild, otherUnionId);
      });
    });

    // ── Propres unions — V vers le bas, enfants encore plus bas ──────
    // Forme : self \  / partner
    //              \/
    //           union node
    //           /   \
    //        enfant enfant
    const newOwnUnions = data.ownUnions.filter(ou => {
      if (!ou.union) return true; // entrée parent-unique, toujours inclure
      return !unionIdsRef.current.has(`u-${ou.union.id}`);
    });
    // Compte seulement les unions réelles (avec partenaire) pour la répartition en cercle
    const N = newOwnUnions.filter(ou => ou.partner !== null).length;
    // Pour N impairs > 1 (triangle, pentagone…), démarrer à π/2 (devant)
    // pour que la distribution soit symétrique gauche/droite depuis la caméra.
    // N=1 et N pairs : démarrage à 0 (droite), ce qui donne gauche+droite pour N=2.
    const startAngle = (N % 2 === 1 && N > 1) ? Math.PI / 2 : 0;
    let circleIdx = 0;

    newOwnUnions.forEach((ou, j) => {
      const unionId = ou.union ? `u-${ou.union.id}` : `solo-${personId}-${j}`;

      // ── Cas parent unique : enfants directement sous self ─────────
      if (!ou.partner) {
        (ou.children ?? []).forEach((child, k) => {
          const kSide = k % 2 === 0 ? 1 : -1;
          const kDist = Math.ceil((k + 1) / 2);
          const childDesired: [number, number, number] = [
            selfPos[0] + kSide * kDist * 8,
            selfPos[1] - PARENT_Y,
            selfPos[2] + RADIUS * 0.5,
          ];
          const actualChild = addPerson(child, childDesired);
          addEdge(`e-solo-child-${child.id}`, selfPos, actualChild);
        });
        return;
      }

      // ── Cas normal : partenaire + union en V ─────────────────────
      // Répartition uniforme en cercle autour de self
      const angle = startAngle + (2 * Math.PI / Math.max(N, 1)) * circleIdx;
      circleIdx++;

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
      addEdge(`e-${unionId}-self`,    selfPos,       actualUnionPos, unionId);
      addEdge(`e-${unionId}-partner`, actualPartner, actualUnionPos, unionId);

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
        addEdge(`e-child-${child.id}-${unionId}`, actualUnionPos, actualChild, unionId);
      });
    });

    // ── Dispatch séquentiel organique (comme un arbre qui pousse) ──
    const now = Date.now();
    const STEP = 650; // ms entre chaque apparition

    // Helper : envoie des nœuds + edges après un délai, avec birthTime pour l'anim spawn
    const send = (
      ps: GraphPerson[], us: GraphUnion[], es: GraphEdge[], delayMs: number,
    ) => {
      const bt = now + delayMs;
      const tid = setTimeout(() => {
        if (ps.length) setPersons(prev => {
          const seen = new Set(prev.map(p => p.id));
          const fresh = ps.filter(p => !seen.has(p.id)).map(p => ({ ...p, birthTime: bt }));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        if (us.length) setUnions(prev => {
          const seen = new Set(prev.map(u => u.id));
          const fresh = us.filter(u => !seen.has(u.id)).map(u => ({ ...u, birthTime: bt }));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        if (es.length) setEdges(prev => {
          const seen = new Set(prev.map(e => e.id));
          const fresh = es.filter(e => !seen.has(e.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
      }, delayMs);
      pendingTimeoutsRef.current.push(tid);
    };

    // Triage des nœuds
    const selfNode   = newPersons.find(p => p.id === personId);
    const fatherNode = data.father ? newPersons.find(p => p.id === data.father!.id) : null;
    const motherNode = data.mother ? newPersons.find(p => p.id === data.mother!.id) : null;
    const parentUnionNode = newUnions.find(u => u.id === puid);

    // Edges liées aux parents (toutes apparaissent avec le nœud union pour "connecter" d'un coup)
    const parentEdges = newEdges.filter(e =>
      (data.father && e.id.includes(`f-${data.father.id}`)) ||
      (data.mother && e.id.includes(`m-${data.mother.id}`)) ||
      e.id === `e-pu-${puid}-${personId}` ||   // union → moi (fix : inclut le puid exact)
      e.id.startsWith(`e-single`)
    );
    const parentEdgeIds = new Set(parentEdges.map(e => e.id));

    // Siblings
    const sibNodes  = data.siblings.map(s => newPersons.find(p => p.id === s.id)).filter(Boolean) as GraphPerson[];
    const sibEdges  = (sib: GraphPerson) => newEdges.filter(e => e.id.includes(`sib-${sib.id}`));
    const sibEdgeIds = new Set(sibNodes.flatMap(s => sibEdges(s).map(e => e.id)));

    // Demi-frères/sœurs
    const halfIds = new Set([
      ...data.motherOtherUnions.flatMap(m => [m.partner?.id, ...m.children.map(c => c.id)].filter(Boolean) as string[]),
      ...data.fatherOtherUnions.flatMap(f => [f.partner?.id, ...f.children.map(c => c.id)].filter(Boolean) as string[]),
    ]);
    const halfNodes = newPersons.filter(p => halfIds.has(p.id));
    const halfUnions = newUnions.filter(u =>
      data.motherOtherUnions.concat(data.fatherOtherUnions)
        .some(ou => ou.union && `u-${ou.union.id}` === u.id) ||
      u.id.startsWith("mou-") || u.id.startsWith("fou-")
    );
    const halfUnionIds = new Set(halfUnions.map(u => u.id));
    const halfEdges = newEdges.filter(e =>
      !parentEdgeIds.has(e.id) && !sibEdgeIds.has(e.id) &&
      (halfNodes.some(n => e.id.includes(n.id)) || halfUnions.some(u => e.id.includes(u.id)))
    );
    const halfEdgeIds = new Set(halfEdges.map(e => e.id));

    // Propres unions + enfants
    const ownPartnerIds = new Set(data.ownUnions.filter(o => o.partner).map(o => o.partner!.id));
    const ownChildIds   = new Set(data.ownUnions.flatMap(o => o.children.map(c => c.id)));
    const ownNodes  = newPersons.filter(p => ownPartnerIds.has(p.id) || ownChildIds.has(p.id));
    const ownUnions = newUnions.filter(u =>
      !halfUnionIds.has(u.id) && u.id !== puid &&
      data.ownUnions.some(ou => ou.union && `u-${ou.union.id}` === u.id)
    );
    const ownEdges = newEdges.filter(e =>
      !parentEdgeIds.has(e.id) && !sibEdgeIds.has(e.id) && !halfEdgeIds.has(e.id)
    );

    let t = 0;

    // ① Moi
    if (selfNode) { send([selfNode], [], [], t); t += STEP; }

    // ② Père (seul)
    if (fatherNode) { send([fatherNode], [], [], t); t += STEP; }

    // ③ Mère (seule, après le père)
    if (motherNode) { send([motherNode], [], [], t); t += STEP; }

    // ④ Nœud union parentale + toutes les lignes de connexion (d'un coup : "le lien apparaît")
    if (parentUnionNode || parentEdges.length) {
      send([], parentUnionNode ? [parentUnionNode] : [], parentEdges, t);
      t += STEP;
    }

    // ⑤ Frères et sœurs (un par un, chacun avec sa ligne)
    sibNodes.forEach(sib => {
      send([sib], [], sibEdges(sib), t);
      t += STEP;
    });

    // ⑥ Demi-frères/sœurs (en groupe — évite une attente trop longue)
    if (halfNodes.length || halfUnions.length) {
      send(halfNodes, halfUnions, halfEdges, t);
      t += STEP;
    }

    // ⑦ Propres unions + enfants (en groupe)
    if (ownNodes.length || ownUnions.length) {
      send(ownNodes, ownUnions, ownEdges, t);
    }
  }, []);

  // Raccourci Ctrl+Z — undo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const prev = navHistoryRef.current.pop();
        if (!prev) return;
        setNavEntries([...navHistoryRef.current]);
        setPersons(prev.persons);
        setUnions(prev.unions);
        setEdges(prev.edges);
        personsRef.current = prev.persons;
        unionsRef.current  = prev.unions;
        edgesRef.current   = prev.edges;
        expandedRef.current  = new Set(prev.expanded);
        personIdsRef.current = new Set(prev.persons.map(p => p.id));
        unionIdsRef.current  = new Set(prev.unions.map(u => u.id));
        edgeIdsRef.current   = new Set(prev.edges.map(ed => ed.id));
        occupiedPosRef.current = prev.persons.map(p => p.pos);
        personPosRef.current   = new Map(prev.persons.map(p => [p.id, p.pos]));
        unionPosRef.current    = new Map(prev.unions.map(u => [u.id, u.pos]));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!rootId) return;
    expandNode(rootId, [0, 0, 0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId, resetKey, expandNode]);

  const restoreToEntry = useCallback((index: number) => {
    const entry = navHistoryRef.current[index];
    if (!entry) return;
    setPersons(entry.persons); setUnions(entry.unions); setEdges(entry.edges);
    personsRef.current = entry.persons;
    unionsRef.current  = entry.unions;
    edgesRef.current   = entry.edges;
    expandedRef.current  = new Set(entry.expanded);
    personIdsRef.current = new Set(entry.persons.map(p => p.id));
    unionIdsRef.current  = new Set(entry.unions.map(u => u.id));
    edgeIdsRef.current   = new Set(entry.edges.map(ed => ed.id));
    occupiedPosRef.current = entry.persons.map(p => p.pos);
    personPosRef.current   = new Map(entry.persons.map(p => [p.id, p.pos]));
    unionPosRef.current    = new Map(entry.unions.map(u => [u.id, u.pos]));
    navHistoryRef.current = navHistoryRef.current.slice(0, index);
    setNavEntries([...navHistoryRef.current]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClickPerson = useCallback((node: GraphPerson) => {
    setSelectedUnionId(null);
    onSelectMember(node.member);
    focusTargetRef.current = new THREE.Vector3(...node.pos);
    expandNode(node.id, node.pos);
  }, [onSelectMember, expandNode]);

  const handleClickUnion = useCallback((union: Spouse, graphNodeId: string) => {
    setSelectedUnionId(graphNodeId);
    onSelectUnion?.(union);
  }, [onSelectUnion]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <CanvasErrorBoundary>
      <Canvas
        camera={{ position: [4, 35, 55], fov: 60 }}
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
        onClick={() => setSelectedUnionId(null)}
      >
        <CameraReset trigger={cameraReset} />
        <CameraFocusController targetRef={focusTargetRef} />

        <ambientLight intensity={0.6} />
        <pointLight position={[15, 15, 15]} intensity={1.2} />
        <pointLight position={[-15, -10, -10]} intensity={0.4} />
        <pointLight position={[0, -20, 5]} intensity={0.3} color="#6366f1" />

        <OrbitControls makeDefault enableDamping dampingFactor={0.06} autoRotate={autoRotate} autoRotateSpeed={1.2} />
        <CameraPresetController mode={viewMode} />

        {edges.map(e   => <Edge        key={e.id} edge={e} highlighted={!!selectedUnionId && e.unId === selectedUnionId} />)}
        {unions.map(u  => <UnionSphere key={u.id} node={u} onClick={handleClickUnion} selected={selectedUnionId === u.id} />)}
        {persons.map(p => <PersonSphere key={p.id} node={p} onClick={handleClickPerson} />)}
      </Canvas>
      </CanvasErrorBoundary>

      {/* ── Panneau historique de navigation ──────────────── */}
      {showHistory && (
        <aside style={{
          position: "absolute", top: 0, right: 0, height: "100%", width: "13rem",
          background: "rgba(15,23,42,0.95)", backdropFilter: "blur(8px)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          display: "flex", flexDirection: "column", zIndex: 10,
        }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
              Navigation
            </p>
            <p style={{ fontSize: "10px", color: "#475569", margin: "2px 0 0" }}>
              Ctrl+Z ou Revenir ici
            </p>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {/* État actuel */}
            <div style={{
              padding: "6px 8px", borderRadius: "8px",
              background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", flexShrink: 0, display: "inline-block" }} />
              <span style={{ fontSize: "11px", color: "#a5b4fc", fontWeight: 600 }}>État actuel</span>
            </div>

            {navEntries.length === 0 ? (
              <p style={{ fontSize: "11px", color: "#334155", textAlign: "center", padding: "16px 8px", margin: 0 }}>
                Clique sur une sphère pour naviguer
              </p>
            ) : (
              [...navEntries].reverse().map((entry, i) => {
                const originalIndex = navEntries.length - 1 - i;
                return (
                  <div key={entry.id} style={{
                    padding: "6px 8px", borderRadius: "8px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: "11px", color: "#e2e8f0", fontWeight: 600, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {entry.label}
                        </p>
                        <p style={{ fontSize: "10px", color: "#475569", margin: "2px 0 0" }}>
                          {formatRelativeTime(entry.time)}
                        </p>
                      </div>
                      <button
                        onClick={() => restoreToEntry(originalIndex)}
                        style={{
                          flexShrink: 0, fontSize: "10px", fontWeight: 600,
                          background: "rgba(71,85,105,0.8)", color: "#cbd5e1",
                          border: "none", borderRadius: "5px", padding: "3px 7px",
                          cursor: "pointer", marginTop: "2px",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#4f46e5")}
                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(71,85,105,0.8)")}
                      >
                        Revenir
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────
function formatRelativeTime(time: number): string {
  const diff = Date.now() - time;
  if (diff < 60_000) return "À l'instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  return new Date(time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
