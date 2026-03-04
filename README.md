# GeneaSphere

Application web de gestion d'arbre généalogique interactif en 3D — Projet BUT MMI S4.

**Production :** [genea-sphere-lucas-j-mmi.vercel.app](https://genea-sphere-lucas-j-mmi.vercel.app)

---

## Stack technique

| Technologie | Usage |
|---|---|
| **Next.js 16.1.6** (App Router, TypeScript) | Framework fullstack — UI + API REST |
| **Supabase** (PostgreSQL + Auth) | Base de données + authentification JWT |
| **Three.js / React Three Fiber** | Visualisation 3D interactive de l'arbre |
| **@react-three/drei** | Helpers 3D (OrbitControls, Text, Line, Billboard) |
| **Tailwind CSS** | Styles |
| **Zod** | Validation des données (client + serveur) |
| **React Hook Form** | Gestion des formulaires |
| **Jest + Testing Library** | Tests unitaires |

---

## Installation

```bash
git clone https://github.com/LucasJ-MMI/GeneaSphere-LucasJ-MMI.git
cd GeneaSphere-LucasJ-MMI
npm install
cp .env.example .env.local
# Remplir les variables dans .env.local
npm run dev
```

Application disponible sur [http://localhost:3000](http://localhost:3000).

## Variables d'environnement

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |

> Ne jamais committer `.env.local`.

---

## Tests

```bash
npm test                    # tous les tests
npm test -- --coverage      # avec couverture
npm test -- --watch         # mode watch
```

| Fichier | Ce qui est testé |
|---|---|
| `__tests__/api/members.test.ts` | Schéma Zod membre (15 cas) |
| `__tests__/components/MemberCard.test.tsx` | Composant MemberCard (12 cas) |
| `__tests__/components/RegisterForm.test.tsx` | Formulaire d'inscription (9 cas) |
| `__tests__/lib/ui.test.ts` | Classes CSS partagées (6 cas) |

---

## Build & déploiement

```bash
npm run build
npm start
```

L'application est déployée sur **Vercel** — chaque push sur `main` déclenche un déploiement automatique.

Configuration Supabase requise :
- **Site URL** : `https://genea-sphere-lucas-j-mmi.vercel.app`
- **Redirect URLs** : `https://genea-sphere-lucas-j-mmi.vercel.app/**`

**CI/CD (GitHub Actions)** : lint ESLint + tests Jest + build TypeScript sur chaque push/PR.

---

## Structure du projet

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/              # Page connexion
│   │   └── register/           # Page inscription
│   ├── (dashboard)/
│   │   ├── dashboard/          # Tableau de bord
│   │   ├── tree/               # Arbre 3D interactif
│   │   ├── members/            # Gestion des membres
│   │   ├── relations/          # Gestion des unions
│   │   ├── stats/              # Statistiques familiales
│   │   └── admin/              # Administration utilisateurs
│   └── api/
│       ├── auth/               # POST  /api/auth
│       ├── members/            # GET, POST /api/members
│       │   └── [id]/
│       │       ├── route.ts    # GET, PATCH, DELETE /api/members/:id
│       │       ├── history/    # GET  /api/members/:id/history
│       │       └── restore/
│       │           └── [hid]/  # POST /api/members/:id/restore/:hid
│       ├── relations/          # GET, POST /api/relations
│       │   └── [id]/           # PATCH, DELETE /api/relations/:id
│       ├── parentages/
│       │   └── [id]/           # PATCH, DELETE /api/parentages/:id
│       ├── tree/               # GET  /api/tree?person_id=...
│       │   ├── export/         # GET  /api/tree/export
│       │   └── import/         # POST /api/tree/import
│       ├── stats/              # GET  /api/stats
│       └── users/              # GET  /api/users (admin)
├── components/
│   ├── members/                # MemberCard
│   └── tree/                   # FamilyTree3D (Three.js)
├── lib/
│   ├── supabase/               # Clients Supabase (browser + server)
│   ├── schemas/                # Schémas Zod
│   ├── union.ts                # Helpers état union (4 états)
│   └── ui.ts                   # Classes CSS partagées
├── types/                      # Types TypeScript globaux
└── proxy.ts                    # Protection des routes (middleware Next.js 16)
```

---

## Base de données

Migrations dans `supabase/migrations/`.

| Table | Description |
|---|---|
| `profiles` | Étend `auth.users` — rôle admin, statut d'approbation |
| `members` | Nœuds de l'arbre — nom, dates, genre, biographie, photo |
| `spouses` | Unions entre membres (type couple/mariage, dates, séparation) |
| `member_history` | Historique des modifications de chaque membre (versions restaurables) |

> **RLS activé** sur toutes les tables. Les membres `is_private` ne sont visibles que par leur créateur ou un admin. Le premier utilisateur inscrit devient automatiquement admin.

---

## Fonctionnalités

### Auth & Administration
- Inscription avec confirmation email (Supabase Auth + JWT)
- Approbation manuelle des nouveaux comptes par un admin
- Gestion des utilisateurs (admin uniquement)

### Membres & Relations
- Création, modification, suppression de membres
- Upload de photo de profil (Supabase Storage)
- Liens parent/enfant et unions (couple / mariage, avec dates, séparation)
- Membres publics / privés
- Import / export de l'arbre complet au format JSON

### Arbre 3D interactif (`/tree`)
- Visualisation WebGL en temps réel avec Three.js / React Three Fiber
- Chaque personne = une sphère colorée par lignée (nom de famille → couleur déterministe)
- Clic sur une sphère → expansion séquentielle de la famille (parents, fratrie, unions, enfants)
- Animation d'apparition organique : chaque nœud grandit de 0 à sa taille finale (~900 ms)
- Nœuds d'union (♥ / 💔 / 💍 / 💍✗) cliquables pour voir/modifier l'union
- **Contrôles caméra** : rotation (clic gauche), zoom (scroll), déplacement (clic droit)
- **Vues prédéfinies** : Y↑ (dessus), Z→ (face), X→ (côté) avec déplacement verrouillé sur l'axe
- **Undo Ctrl+Z** : annule la dernière expansion de nœud
- **Historique de navigation** (bouton ⏱) : timeline des expansions avec "Revenir ici"
- **Reset 🎯** : revient à la vue initiale

### Historique BDD des membres
- Chaque modification d'un membre crée un snapshot dans `member_history`
- Panneau "Historique" dans la fiche membre : liste les versions avec diff détaillé champ par champ
- Bouton "Restaurer" pour revenir à n'importe quelle version antérieure

### Statistiques
- Total membres, décédés, unions enregistrées
- Membre le plus âgé, âge moyen, prénom le plus courant

---

## Algorithme de placement de l'arbre 3D

> Voir aussi la section dédiée ci-dessous pour une explication complète.

L'arbre est calculé dynamiquement à chaque clic. Les nœuds sont des points en 3D `[x, y, z]` et les traits sont des lignes droites entre ces points. La direction Y est la verticalité (parents en haut, enfants en bas).

**Constantes de placement** (dans `FamilyTree3D.tsx`) :

| Constante | Valeur | Rôle |
|---|---|---|
| `PARENT_Y` | 9 | Décalage vertical entre une génération et ses parents |
| `PARENT_X` | 7 | Écart horizontal père/mère autour de l'axe de l'enfant |
| `UNION_Y` | 4.5 | Hauteur du nœud union entre les deux partenaires |
| `RADIUS` | 13 | Rayon du cercle pour placer les partenaires/demi-fratrie |
| `MIN_DIST` | 7 | Distance minimale entre deux nœuds (anti-collision) |

---

## Pourquoi certains traits sont droits et d'autres en diagonale ?

Les traits sont des **lignes droites en 3D** tirées entre les coordonnées exactes de deux nœuds. Il n'y a pas de courbe ni de coude — c'est une ligne WebGL directe. L'angle apparent dépend entièrement de la différence de position entre les deux extrémités.

### Cas qui donnent des traits droits

**Vertical pur** — père directement au-dessus de l'enfant, sans décalage Z :
```
père [x, y+9, z]
      │  (ligne droite verticale)
moi  [x, y,   z]
```
Cela arrive quand il n'y a qu'un seul parent (père ou mère seul·e) : l'edge `e-single-f` ou `e-single-m` relie directement le parent à l'enfant sans nœud union intermédiaire.

**Horizontal pur** — deux nœuds au même Y, même X, seul Z diffère :
```
frère [x-9, y, z+8] ── [x-9, y, z-8] ── … (même plan horizontal)
```
Les frères/sœurs sont placés au même Y que la personne cliquée, décalés uniquement en Z.

### Cas qui donnent des diagonales

**La structure en V des parents** — c'est le cas le plus visible :

```
père [-7, +9, z]      mère [+7, +9, z]
      \                    /
       \                  /
        union [0, +4.5, z]       ← nœud intermédiaire
               |
              moi [0, 0, z]
```

Le père est à `(-7, +9)` et l'union à `(0, +4.5)` : les deux axes X et Y changent en même temps → diagonale à ~45°. C'est voulu : ça dessine un **V inversé** pour montrer que les deux parents convergent vers l'union.

**Les demi-fratries et partenaires multiples — placement en cercle** :

Quand un parent a eu plusieurs unions, ses partenaires sont répartis en cercle autour de lui à `RADIUS = 13` unités. L'angle est calculé pour ne pas écraser l'union déjà existante :

```ts
const angle = startAngle + (2π / N_total) * slotIdx;
partner.x = parent.x + 13 * cos(angle)
partner.z = parent.z + 13 * sin(angle)
// même Y que le parent → trait complètement horizontal dans le plan XZ
```

Le trait entre le parent et son nœud d'union avec ce partenaire est donc dans le **plan horizontal** (même Y), mais oblique en X/Z selon l'angle.

**L'anti-collision déplace les nœuds** — cause principale des diagonales inattendues :

La fonction `findFreePos` essaie d'abord la position idéale (qui donnerait un trait droit). Si cette position est trop proche d'un nœud existant (< 7 unités), elle cherche une position libre en spirale autour du point désiré :

```
anneau r=1 → 8 candidats répartis en cercle
anneau r=2 → 16 candidats
…jusqu'à r=16
```

Si le père idéal aurait été à `(-7, +9, 0)` mais qu'il y a déjà un nœud là, il sera placé à `(-7, +9, 7)` ou `(-14, +9, 7)` etc. Le trait résultant aura alors une composante Z inattendue → diagonale.

### Résumé visuel

| Situation | Trait |
|---|---|
| Parent unique → enfant | Vertical droit |
| Père → nœud union / Mère → nœud union | Diagonale (le V des parents) |
| Nœud union → enfant | Vertical (ou légèrement oblique si anti-collision) |
| Nœud union → frère/sœur | Oblique (union n'est pas au même Y que les frères) |
| Parent → partenaire autre union | Oblique dans le plan horizontal (cercle) |
| Deux nœuds déplacés par anti-collision | Diagonale quelconque |

---

Projet BUT MMI — Deadline **6 mars 2026**
