# GeneaSphere

Application de gestion d'arbre généalogique — Projet BUT MMI.

**Production :** [genea-sphere-lucas-j-mmi.vercel.app](https://genea-sphere-lucas-j-mmi.vercel.app)

---

## Stack technique

| Technologie | Usage |
|---|---|
| **Next.js 16.1.6** (App Router, TypeScript) | Framework fullstack — UI + API REST |
| **Supabase** (PostgreSQL + Auth) | Base de données + authentification JWT |
| **D3.js** | Visualisation interactive de l'arbre |
| **Tailwind CSS** | Styles |
| **Zod** | Validation des données (client + serveur) |
| **React Hook Form** | Gestion des formulaires |
| **Jest + Testing Library** | Tests unitaires |

---

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/LucasJ-MMI/GeneaSphere-LucasJ-MMI.git
cd GeneaSphere-LucasJ-MMI

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Remplir les valeurs dans .env.local
```

## Variables d'environnement

Copier `.env.example` en `.env.local` et renseigner :

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |

> **Note :** Ne jamais committer `.env.local` ni exposer la `service_role` key publiquement.

---

## Démarrage

```bash
npm run dev
```

Application disponible sur [http://localhost:3000](http://localhost:3000).

---

## Tests

```bash
# Lancer tous les tests
npm test

# Avec couverture de code
npm test -- --coverage

# Mode watch (relance à chaque modification)
npm test -- --watch
```

### Fichiers de tests

| Fichier | Ce qui est testé |
|---|---|
| `__tests__/api/members.test.ts` | Schéma Zod membre (15 cas) |
| `__tests__/components/MemberCard.test.tsx` | Composant MemberCard (12 cas) |
| `__tests__/components/RegisterForm.test.tsx` | Formulaire d'inscription (9 cas) |
| `__tests__/lib/ui.test.ts` | Classes CSS partagées `inputCls` (6 cas) |

---

## Build

```bash
npm run build
npm start
```

---

## Structure du projet

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/            # Page connexion
│   │   └── register/         # Page inscription
│   ├── (dashboard)/
│   │   ├── dashboard/        # Tableau de bord
│   │   ├── tree/             # Arbre généalogique interactif
│   │   ├── members/          # Gestion des membres
│   │   ├── relations/        # Gestion des relations
│   │   ├── stats/            # Statistiques familiales
│   │   └── admin/            # Administration utilisateurs
│   └── api/
│       ├── members/          # GET, POST /api/members
│       │   └── [id]/         # PATCH /api/members/:id
│       ├── relations/        # GET, POST /api/relations
│       │   └── [id]/         # PATCH, DELETE /api/relations/:id
│       ├── parentages/
│       │   └── [id]/         # PATCH, DELETE /api/parentages/:id
│       ├── tree/             # GET /api/tree?person_id=...
│       ├── stats/            # GET /api/stats
│       └── auth/             # POST /api/auth
├── components/
│   ├── members/              # MemberCard
│   ├── tree/                 # FamilyTree (D3.js)
│   └── forms/                # RegisterForm, LoginForm
├── lib/
│   ├── supabase/             # Clients Supabase (browser + server)
│   ├── schemas/              # Schémas Zod (member.ts)
│   └── ui.ts                 # Classes CSS partagées
├── types/                    # Types TypeScript globaux
└── proxy.ts                  # Protection des routes (remplace middleware.ts)
```

---

## Base de données

Le schéma SQL se trouve dans `supabase/migrations/00001_initial_schema.sql`.

### Tables

| Table | Description |
|---|---|
| `profiles` | Étend `auth.users` — rôle admin, statut d'approbation |
| `members` | Nœuds de l'arbre — nom, dates, genre, biographie |
| `parentage` | Lien enfant → père/mère (unique par enfant) |
| `spouses` | Unions entre membres (date, séparation) |

### Appliquer la migration

```bash
supabase db push
```

### Sécurité (RLS)

Row Level Security activé sur toutes les tables :
- Les membres `is_private` ne sont visibles que par leur créateur ou un admin
- Seuls les utilisateurs approuvés peuvent créer des membres/relations
- Le premier utilisateur inscrit devient automatiquement admin

---

## Fonctionnalités

1. **Inscription & Auth JWT** — Supabase Auth avec confirmation email
2. **Administration utilisateurs** — approbation des nouveaux comptes
3. **Gestion des membres** — ajout, modification, suppression
4. **Relations familiales** — liens parent/enfant et unions
5. **Visualisation D3.js** — arbre interactif, navigation, expansion des ancêtres jusqu'aux arrière-grands-parents
6. **Navigation** — clic sur un nœud pour centrer l'arbre, historique de navigation
7. **Statistiques familiales** — total, décédés, unions, membre le plus âgé, âge moyen, prénom le plus courant
8. **Droits & confidentialité** — membres publics / privés

---

## Déploiement

L'application est déployée sur **Vercel** avec CI/CD automatique.

1. Connecter le dépôt GitHub à Vercel
2. Ajouter les variables d'environnement dans Vercel → Settings → Environment Variables
3. Configurer l'URL de redirection Supabase → Authentication → URL Configuration :
   - **Site URL** : `https://genea-sphere-lucas-j-mmi.vercel.app`
   - **Redirect URLs** : `https://genea-sphere-lucas-j-mmi.vercel.app/**`
4. Chaque push sur `main` déclenche un déploiement automatique

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) :
- **Lint** — ESLint sur chaque push/PR
- **Tests** — Jest avec couverture
- **Build** — `next build` pour valider la compilation TypeScript

---

Deadline : **6 mars 2026** · BUT MMI
