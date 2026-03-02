# Architecture du graphe 3D — GeneaSphere

## Vue d'ensemble

```
Utilisateur clique sur une sphère
        ↓
expandNode(personId, basePos)   ← appel récursif possible
        ↓
GET /api/tree?person_id=...     ← 1 appel réseau par nœud
        ↓
TreeData { person, father, mother, siblings,
           parentUnion, motherOtherUnions,
           fatherOtherUnions, ownUnions }
        ↓
Placement 3D (positions XYZ)
        ↓
React state : persons[] unions[] edges[]
        ↓
@react-three/fiber → Three.js → WebGL
```

---

## 1. Récupération des données (`/api/tree`)

### Point d'entrée
`GET /api/tree?person_id=<uuid>` — `src/app/api/tree/route.ts`

### Ce que l'API retourne pour un nœud donné

| Champ | Contenu |
|-------|---------|
| `person` | La personne centrale |
| `father` / `mother` | Ses parents biologiques |
| `siblings` | Frères/sœurs (même père ET même mère) |
| `parentUnion` | L'union entre père et mère (table `spouses`) |
| `motherOtherUnions` | **Toutes** les autres unions de la mère (requête directe `spouses`), avec leurs enfants et partenaires |
| `fatherOtherUnions` | Idem côté père |
| `ownUnions` | Ses propres unions (conjoints + enfants) |

### Pourquoi requêter `spouses` directement ?

Ancienne approche (buggy) : chercher les enfants de la mère groupés par `father_id`.
→ Oubliait les unions sans enfants communs.

Approche actuelle : `SELECT * FROM spouses WHERE member1_id = motherId OR member2_id = motherId`
→ Trouve TOUTES les unions, même celles sans enfants.

---

## 2. Structure du graphe en mémoire

### Types internes (`FamilyTree3D.tsx`)

```ts
GraphPerson { id, member: Member, pos: [x,y,z], expanded: boolean }
GraphUnion  { id, union: Spouse | null, pos: [x,y,z] }
GraphEdge   { id, from: [x,y,z], to: [x,y,z] }
```

### Refs (état mutable, hors React)

| Ref | Rôle |
|-----|------|
| `expandedRef` | Set d'IDs déjà expandés → évite les appels doubles |
| `personIdsRef` | Set d'IDs de personnes déjà placées |
| `unionIdsRef` | Set d'IDs d'unions déjà placées |
| `edgeIdsRef` | Set d'IDs d'arêtes déjà tracées |
| `occupiedPosRef` | Liste de positions `[x,y,z]` occupées → anti-collision |
| `personPosRef` | Map id → position pour retrouver une position existante |
| `unionPosRef` | Idem pour les unions |

Ces refs sont utilisées dans `expandNode` (callback stable via `useCallback`) pour vérifier si un élément est déjà présent avant de l'ajouter au state React.

---

## 3. Placement 3D — Constantes et règles

### Constantes de base

```
MIN_DIST = 7        → distance minimale entre deux sphères
PARENT_Y = 9        → décalage vertical parents (au-dessus)
PARENT_X = 7        → décalage horizontal père/mère (gauche/droite)
UNION_Y  = 4.5      → décalage vertical du nœud d'union
RADIUS   = 13       → rayon du cercle des unions propres / autres unions
```

### Placement des parents

```
père  ← [-PARENT_X, +PARENT_Y, zShift]   (gauche + haut)
mère  ← [+PARENT_X, +PARENT_Y, zShift]   (droite + haut)
unionParent ← midpoint(père, mère) à hauteur +UNION_Y
```

Le `zShift` est calculé automatiquement pour éviter que père/mère se superposent à des nœuds déjà placés.

### Placement des unions propres (`ownUnions`)

Répartition uniforme en cercle autour de `self` dans le plan XZ :

```
N = nombre d'unions avec partenaire
startAngle = N impair > 1 ? π/2 : 0
angle_i = startAngle + (2π / N) * i

partnerPos = self + RADIUS * [cos(angle_i), 0, sin(angle_i)]
unionNode  = midpoint(self, partner) à hauteur -UNION_Y  (V vers le bas)
enfant     = unionNode - PARENT_Y en Y
```

**Pourquoi `startAngle = π/2` pour N impair ?**
→ Pour N=3, sans offset : 0°, 120°, 240° → 2 unions à gauche, 1 à droite (asymétrique).
→ Avec π/2 : 90°, 210°, 330° → front + gauche-arrière + droite-arrière (symétrique).

### Placement des autres unions d'un parent (`motherOtherUnions`)

Même cercle que les `ownUnions` de ce parent, mais vu de l'enfant :

```
N_total = autres unions avec partenaire + 1 (pour l'union parent)
→ forme un triangle équilatéral cohérent (ex: 3 unions = 120° d'écart)

parentDir = atan2(père.z - mère.z, père.x - mère.x)
parentSlot = slot le plus proche de parentDir dans le cercle à N_total
autres unions → slots restants (N_total - 1 slots)
```

**Pourquoi inclure l'union parent dans N_total ?**
→ Si on ne compte que les 2 autres unions (N=2), elles vont à 0° et 180° (ligne droite).
→ Avec N=3, le père occupant un slot à ~210°, les 2 autres vont à 90° et 330° → triangle.

### Anti-collision (`findFreePos`)

Quand la position désirée est occupée, `findFreePos` cherche en spirale :
- Anneaux concentriques r=1..16, chaque anneau divisé en `r*8` positions
- Retourne la première position libre à distance `r * MIN_DIST`
- La hauteur Y est préservée

---

## 4. Rendu Three.js

### Composants de rendu

| Composant | Rôle |
|-----------|------|
| `PersonSphere` | Sphère colorée par nom de famille (`nameToHex`), scale lerp au hover |
| `UnionSphere` | Petite sphère (r=0.4) colorée par type d'union, cliquable |
| `Edge` | Ligne entre deux positions (`@react-three/drei Line`) |
| `CameraFocusController` | Lerp doux de la cible OrbitControls vers `focusTargetRef` |
| `CameraReset` | Reset position caméra à (4, 22, 32) |

### Canvas Three.js

```tsx
<Canvas camera={{ position: [4, 22, 32], fov: 60 }}>
  <OrbitControls makeDefault />   ← makeDefault = accessible via useThree().controls
  <ambientLight />
  <directionalLight />
  <CameraFocusController />
  <CameraReset trigger={cameraReset} />
  {persons.map(p => <PersonSphere onClick={handleClickPerson} />)}
  {unions.map(u => <UnionSphere onClick={handleClickUnion} />)}
  {edges.map(e => <Edge />)}
</Canvas>
```

### Couleur des personnes

`nameToHex(lastName)` → hash du nom de famille → teinte HSL déterministe
→ Toutes les personnes du même nom ont la même couleur de sphère.

---

## 5. Flux d'interaction complet

```
1. Sélection d'un membre dans le <select> de la barre
2. selectedId change → FamilyTree3D reçoit rootId
3. useEffect [rootId] → reset complet (state + refs)
4. useEffect [rootId, expandNode] → expandNode(rootId, [0,0,0])
5. API call GET /api/tree?person_id=rootId
6. Placement : parents, frères, unions propres, autres unions des parents
7. setPersons / setUnions / setEdges → re-render Three.js
8. Clic sur une sphère → handleClickPerson(node)
   → onSelectMember(node.member) → panneau d'info dans tree/page.tsx
   → expandNode(node.id, node.pos) → appel API, placement supplémentaire
9. Clic sur un nœud d'union → handleClickUnion(union)
   → onSelectUnion(union) → panneau union
```

---

## 6. Export / Import JSON

### Format du fichier

```json
{
  "version": "1.0",
  "exported_at": "2026-03-02T...",
  "members": [ { ...tous les champs Member } ],
  "spouses": [ { ...tous les champs Spouse } ]
}
```

### Export (`GET /api/tree/export`)

1. Récupère tous les `members` de l'utilisateur (`created_by = user.id`)
2. Récupère tous les `spouses` dont au moins un membre appartient à l'utilisateur
3. Retourne le JSON

### Import (`POST /api/tree/import`)

Import en 3 phases pour respecter les contraintes de clés étrangères :

```
Phase 1 : créer tous les membres SANS father_id/mother_id
          → construire idMap: oldId → newId (nouveaux UUIDs Supabase)

Phase 2 : mettre à jour father_id/mother_id avec les newIds

Phase 3 : créer les spouses avec les newIds
```

---

## 7. Schéma de la base de données (simplifié)

```
members
  id, first_name, last_name, gender,
  birth_date, birth_place, death_date,
  bio, photo_url, is_private,
  father_id → members.id,
  mother_id → members.id,
  created_by → profiles.id

spouses
  id, member1_id → members.id, member2_id → members.id,
  union_type (couple | marriage),
  union_date, separation_date
```

Les parentés (père/mère) sont stockées directement sur `members` (colonnes `father_id`, `mother_id`), pas dans une table séparée.
