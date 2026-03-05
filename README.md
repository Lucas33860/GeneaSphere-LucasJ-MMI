# GeneaSphere

Application web de gestion d'arbres généalogiques interactifs en 3D — Projet BUT MMI S4.

**Production :** [genea-sphere-lucas-j-mmi.vercel.app](https://genea-sphere-lucas-j-mmi.vercel.app)

---

## Stack technique

| Technologie | Usage |
|---|---|
| **Next.js 16.1.6** (App Router, TypeScript) | Framework fullstack — UI + API REST |
| **Supabase** (PostgreSQL + Auth + RLS) | Base de données + authentification JWT |
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

## Authentification & Sécurité

### Système d'authentification

GeneaSphere utilise **Supabase Auth** comme fournisseur d'identité, intégré via `@supabase/ssr` pour une gestion sécurisée des sessions en SSR (Server-Side Rendering).

#### Deux modes de connexion

| Mode | Mécanisme |
|---|---|
| **Email + mot de passe** | `supabase.auth.signUp()` / `signInWithPassword()` + confirmation email |
| **Google OAuth** | `supabase.auth.signInWithOAuth({ provider: 'google' })` + callback `/auth/callback` |

#### Flux Email / Mot de passe

1. L'utilisateur soumet le formulaire (validé par **Zod** côté client)
2. Supabase crée le compte et envoie un **email de confirmation**
3. Après confirmation, connexion → Supabase retourne un **JWT signé (durée 24h)**
4. Le JWT est stocké dans des **cookies HTTP-only** via `@supabase/ssr` (immunisé contre le vol XSS)
5. À chaque requête, `proxy.ts` (middleware Next.js) **rafraîchit automatiquement** le JWT si nécessaire

#### Flux Google OAuth (PKCE)

```
Navigateur → supabase.auth.signInWithOAuth('google')
          → Redirection vers accounts.google.com
          → Google authentifie → retourne un code PKCE
          → /auth/callback?code=xxx
          → supabase.auth.exchangeCodeForSession(code)
          → Session JWT créée dans les cookies → /dashboard
```

Le flow utilise **PKCE (Proof Key for Code Exchange)** — Supabase le gère automatiquement, ce qui empêche les attaques par interception du code OAuth.

#### Protection des routes — `proxy.ts`

```
Toute requête → proxy.ts
  ├── Route publique (/, /login, /register, /auth/callback) → passe
  ├── Utilisateur non connecté + route protégée → redirect /login
  └── Utilisateur connecté + /login ou /register → redirect /dashboard
```

Le middleware s'exécute **côté serveur** sur chaque requête, avant que la page soit rendue.

#### Deux clients Supabase

| Fichier | Usage |
|---|---|
| `src/lib/supabase/client.ts` | Browser (composants client) — `createBrowserClient` |
| `src/lib/supabase/server.ts` | Server Components & Route Handlers — `createServerClient` + cookies |

---

### Mesures de sécurité

#### 1. JWT dans cookies HTTP-only

Les tokens ne sont **jamais exposés à JavaScript** (contrairement à localStorage). Un script malveillant injecté via XSS ne peut pas les lire.

#### 2. Row Level Security (RLS) PostgreSQL

Chaque table Supabase a des politiques RLS actives. Même si quelqu'un forge une requête directement vers la base de données avec la clé `anon`, il ne voit que **ses propres données**.

Exemples de politiques :
- `members` : lisibles uniquement si `tree_id` appartient à un arbre auquel l'utilisateur a accès (et si `is_private = false` ou si l'utilisateur est le créateur)
- `trees` : visible uniquement si `owner_id = auth.uid()` ou si `tree_access` contient `(tree_id, auth.uid())`

#### 3. Validation Zod côté API

Tous les `POST` / `PATCH` des routes API valident les données avec un schéma Zod avant toute interaction avec la base. Cela empêche les injections de types inattendus.

#### 4. Vérification des rôles avant chaque écriture

```ts
// Exemple dans /api/members
const role = await getUserTreeRole(supabase, treeId, user.id);
if (!canWrite(role)) return Response.json({ error: "Interdit" }, { status: 403 });
```

`getUserTreeRole()` interroge `tree_access` et retourne le rôle réel (`owner` > `admin` > `editor` > `reader`). Cette vérification est faite **côté serveur**, indépendamment du client.

#### 5. Confidentialité des membres (`is_private`)

Un membre marqué `is_private` n'est visible que par son créateur ou un admin. Les autres membres authentifiés ne le voient pas, même s'ils ont accès à l'arbre.

#### 6. Mots de passe

Supabase stocke les mots de passe avec **bcrypt** (salt aléatoire par utilisateur). GeneaSphere n'a jamais accès aux mots de passe en clair.

---

### Configurer Google OAuth (Supabase + Google Cloud)

#### Côté Google Cloud Console

1. Aller sur [console.cloud.google.com](https://console.cloud.google.com)
2. Créer un projet (ou utiliser l'existant)
3. **APIs & Services → Credentials → Create OAuth 2.0 Client ID**
4. Type : **Web application**
5. Ajouter dans **Authorized redirect URIs** :
   ```
   https://<votre-projet>.supabase.co/auth/v1/callback
   ```
6. Copier **Client ID** et **Client Secret**

#### Côté Supabase

1. **Authentication → Providers → Google** → activer
2. Coller **Client ID** et **Client Secret**
3. Dans **Authentication → URL Configuration** :
   - Site URL : `https://genea-sphere-lucas-j-mmi.vercel.app`
   - Redirect URLs : `https://genea-sphere-lucas-j-mmi.vercel.app/**`

En local, ajouter également `http://localhost:3000/**` dans les Redirect URLs.

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
| `__tests__/lib/tree-access.test.ts` | Rôles/permissions arbre — canWrite, canDelete, canShare, getUserTreeRole (17 cas) |
| `__tests__/lib/union.test.ts` | États d'union — stateToBody, unionToState4, UNION_STATE_OPTIONS (22 cas) |

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
│   │   ├── dashboard/          # Tableau de bord (cartes arbres + partagés)
│   │   ├── tree/               # Arbre 3D interactif + ShareModal
│   │   ├── members/            # Gestion des membres
│   │   ├── relations/          # Gestion des unions
│   │   ├── stats/              # Statistiques familiales
│   │   └── admin/              # Administration utilisateurs
│   └── api/
│       ├── auth/               # POST  /api/auth
│       ├── trees/              # GET, POST /api/trees
│       │   └── [id]/
│       │       ├── route.ts    # GET, PATCH, DELETE /api/trees/:id
│       │       └── access/     # GET, POST /api/trees/:id/access
│       │           └── [userId]/ # PATCH, DELETE /api/trees/:id/access/:userId
│       ├── members/            # GET, POST /api/members?treeId=
│       │   └── [id]/
│       │       ├── route.ts    # GET, PATCH, DELETE /api/members/:id
│       │       ├── history/    # GET  /api/members/:id/history
│       │       └── restore/
│       │           └── [hid]/  # POST /api/members/:id/restore/:hid
│       ├── relations/          # GET, POST /api/relations?treeId=
│       │   └── [id]/           # PATCH, DELETE /api/relations/:id
│       ├── parentages/
│       │   └── [id]/           # PATCH, DELETE /api/parentages/:id
│       ├── tree/               # GET  /api/tree?person_id=&treeId=
│       │   ├── export/         # GET  /api/tree/export?treeId=
│       │   └── import/         # POST /api/tree/import?treeId=
│       ├── stats/              # GET  /api/stats?treeId=
│       ├── users/              # GET  /api/users (admin)
│       │   └── search/         # GET  /api/users/search?q= (partage)
├── components/
│   ├── members/                # MemberCard
│   └── tree/                   # FamilyTree3D (Three.js)
├── lib/
│   ├── supabase/               # Clients Supabase (browser + server)
│   ├── schemas/                # Schémas Zod
│   ├── tree-access.ts          # Helpers rôles : getUserTreeRole, canWrite, canDelete, canShare
│   ├── union.ts                # Helpers état union (4 états)
│   └── ui.ts                   # Classes CSS partagées
├── types/                      # Types TypeScript globaux (Tree, TreeAccessEntry, Member…)
└── proxy.ts                    # Protection des routes (middleware Next.js 16)
```

---

## Base de données

Migrations dans `supabase/migrations/`.

| Table | Description |
|---|---|
| `profiles` | Étend `auth.users` — rôle admin, statut d'approbation |
| `trees` | Arbre généalogique nommé — id, name, owner_id |
| `tree_access` | Accès partagés par arbre — tree_id, user_id, role |
| `members` | Nœuds de l'arbre — nom, dates, genre, biographie, photo, **tree_id** |
| `spouses` | Unions entre membres (type couple/mariage, dates, séparation), **tree_id** |
| `member_history` | Historique des modifications de chaque membre (versions restaurables) |

> **RLS activé** sur toutes les tables. Les membres `is_private` ne sont visibles que par leur créateur ou un admin. Le premier utilisateur inscrit devient automatiquement admin.

---

## Système multi-arbres et partage

Chaque utilisateur peut créer **plusieurs arbres** nommés et les partager avec d'autres comptes selon quatre rôles, à la manière de Google Docs.

### Rôles

| Action | owner | admin | editor | reader |
|--------|:-----:|:-----:|:------:|:------:|
| Voir membres & unions | ✓ | ✓ | ✓ | ✓ |
| Ajouter / modifier membres | ✓ | ✓ | ✓ | ✗ |
| Supprimer membres & unions | ✓ | ✓ | ✗ | ✗ |
| Gérer les accès (partager) | ✓ | ✓ | ✗ | ✗ |
| Supprimer l'arbre | ✓ | ✗ | ✗ | ✗ |

### Fonctionnement
- **Dashboard** : section "Mes arbres" (badge Propriétaire) + section "Partagés avec moi" (badge rôle coloré)
- **Bouton ＋ Créer un arbre** : modal avec saisie du nom → POST `/api/trees`
- **Sélecteur d'arbre** dans la barre de la page `/tree` : change `?treeId=` dans l'URL
- **Bouton 🔗 Partager** (visible si `canShare`) : ouvre le `ShareModal`
  - Recherche d'utilisateur par nom ou email → GET `/api/users/search?q=`
  - Assigner un rôle Lecteur / Éditeur / Admin → POST `/api/trees/:id/access`
  - Modifier ou révoquer un accès existant
- Toutes les actions d'écriture vérifient le rôle côté API via `getUserTreeRole()` avant d'exécuter la requête Supabase.

---

## Fonctionnalités

### Auth & Administration
- Inscription email + confirmation (Supabase Auth + JWT HTTP-only cookies)
- **Connexion Google OAuth** (PKCE) — un clic, pas de mot de passe
- Approbation manuelle des nouveaux comptes par un admin
- Gestion des utilisateurs (admin uniquement)
- RLS PostgreSQL + vérification des rôles côté API

### Arbres multiples & Partage
- Création de plusieurs arbres nommés par utilisateur
- Partage par rôle (lecteur / éditeur / admin / propriétaire)
- Dashboard centralisé avec tous ses arbres + les arbres partagés

### Membres & Relations
- Création, modification, suppression de membres
- Upload de photo de profil (Supabase Storage)
- Liens parent/enfant et unions (couple / mariage, avec dates, séparation)
- Membres publics / privés (`is_private`)
- Import / export de l'arbre complet au format JSON (scope par arbre)
- Boutons d'action conditionnels selon le rôle de l'utilisateur courant

### Arbre 3D interactif (`/tree`)
- Visualisation WebGL en temps réel avec Three.js / React Three Fiber
- Chargement dynamique SSR désactivé (`dynamic(..., { ssr: false })`) + `ErrorBoundary` pour éviter les crashs WebGL côté serveur
- Mémoïsation complète du composant (`React.memo`) pour éviter les re-renders inutiles
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
- Total membres, décédés, unions enregistrées (filtrés par arbre)
- Membre le plus âgé, âge moyen, prénom le plus courant

---

## Algorithme de placement de l'arbre 3D

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
