# GeneaSphere

Application de gestion d'arbre généalogique — Projet BUT MMI.

## Stack technique

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS** pour le style
- **Supabase** (PostgreSQL + Auth + Storage)
- **D3.js** pour la visualisation de l'arbre
- **Zod** pour la validation des données
- **Jest + Testing Library** pour les tests

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/<votre-org>/GeneaSphere-LucasJ-MMI.git
cd GeneaSphere-LucasJ-MMI

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Remplir les valeurs dans .env.local
```

## Variables d'environnement

Copier `.env.example` en `.env.local` et renseigner :

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de votre projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service Supabase (serveur uniquement) |
| `NEXTAUTH_SECRET` | Secret pour les sessions |

## Démarrage

```bash
npm run dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

## Tests

```bash
# Lancer les tests
npm test

# Avec couverture
npm test -- --coverage

# Mode watch
npm test -- --watch
```

## Build

```bash
npm run build
npm start
```

## Structure du projet

```
src/
├── app/
│   ├── (auth)/          # Pages connexion / inscription
│   ├── (dashboard)/     # Pages protégées (dashboard, membres, arbre…)
│   └── api/             # Routes API REST
├── components/
│   ├── members/         # Cartes et formulaires membres
│   ├── tree/            # Composant D3.js arbre
│   ├── forms/           # Formulaires auth
│   └── ui/              # Composants réutilisables
├── lib/
│   ├── supabase/        # Clients Supabase (browser + server)
│   ├── auth.ts          # Helpers session
│   └── utils.ts
├── types/               # Types TypeScript globaux
└── hooks/               # Hooks React personnalisés
```

## Base de données

Le schéma SQL se trouve dans `supabase/migrations/00001_initial_schema.sql`.

Tables : `profiles`, `members`, `parentage`, `spouses`

Pour appliquer la migration, utilisez l'interface Supabase ou la CLI :

```bash
supabase db push
```

## Fonctionnalités

1. **Inscription & Auth JWT** — via Supabase Auth
2. **Administration utilisateurs** — approbation des nouveaux membres
3. **Gestion des membres** — ajout, modification, suppression de nœuds
4. **Relations familiales** — parents/enfants et conjoints
5. **Visualisation graphique** — arbre interactif avec D3.js
6. **Recherche & navigation** — recherche par nom, filtre
7. **Statistiques familiales** — statistiques calculées
8. **Droits & confidentialité** — membres publics / privés

## Déploiement

L'application peut être déployée sur **Vercel** :

1. Connecter le dépôt GitHub à Vercel
2. Ajouter les variables d'environnement dans les settings Vercel
3. Déploiement automatique à chaque push sur `main`

## CI/CD

GitHub Actions (`/.github/workflows/ci.yml`) :
- **Lint** : ESLint sur chaque push/PR
- **Tests** : Jest avec couverture
- **Build** : `next build` pour valider la compilation

---

Deadline : **6 mars 2026** · BUT MMI
