# GeneaSphere — Présentation projet BUT MMI S4
### Durée : 15 minutes

---

## 0. Accroche (30 sec)

> "GeneaSphere, c'est un outil de gestion d'arbres généalogiques — mais pas juste un tableau avec des cases. L'idée c'est de rendre quelque chose d'habituellement statique et ennuyeux en quelque chose d'interactif, visuel, et collaboratif. L'arbre s'explore en 3D, on peut le partager, y travailler à plusieurs, et analyser sa famille avec des statistiques."

**Production live :** genea-sphere-lucas-j-mmi.vercel.app

---

## 1. Contexte & cahier des charges (1 min)

**Projet de 3 semaines** — BUT MMI S4

**8 fonctionnalités imposées :**
1. Inscription & authentification JWT
2. Administration des utilisateurs
3. Gestion des membres (nœuds de l'arbre)
4. Relations familiales (parent/enfant, conjoints)
5. Visualisation graphique interactive
6. Recherche & navigation
7. Statistiques familiales
8. Droits & confidentialité

**Contraintes techniques imposées :**
- Next.js (fullstack)
- JWT pour l'auth
- D3.js recommandé pour la visu
- GitHub Actions CI/CD
- Tests unitaires

---

## 2. Approche — comment je m'y suis pris (2 min)

### La méthode MVP

J'ai découpé le projet en **3 phases** :

**Semaine 1 — MVP fonctionnel**
- Auth email/mot de passe qui marche
- CRUD membres basique (ajout, édition, suppression)
- Relations parent/enfant et unions
- Base de données Supabase + RLS activé

Objectif : avoir quelque chose qui tourne, même moche. Pas de design, pas de 3D. Juste que les données se sauvent et que l'auth protège les routes.

**Semaine 2 — Valeur ajoutée**
- Arbre 3D avec Three.js (j'ai choisi ça plutôt que D3.js — j'y reviens)
- Système multi-arbres (plusieurs arbres par utilisateur)
- Partage par rôles (owner / admin / editor / reader) — comme Google Docs
- Statistiques familiales calculées côté API
- Upload de photos

**Semaine 3 — Finitions**
- Historique des modifications avec restauration
- Import / Export JSON
- Tests unitaires (91 tests)
- CI/CD GitHub Actions
- Design final

### Ce que j'ai sacrifié / priorisé

J'ai **choisi Three.js** plutôt que D3.js pour la visualisation, parce que D3 en 2D c'est bien pour des arbres simples mais ça devient vite illisible avec beaucoup de membres. En 3D on peut faire pivoter, zoomer, et l'espace est infini dans les 3 axes.

J'ai **sacrifié** une app mobile native pour avoir un responsive web correct — c'est accessible depuis n'importe quel appareil sans installation.

---

## 3. Stack technique & pourquoi ces choix (2 min)

| Technologie | Rôle | Pourquoi ce choix |
|---|---|---|
| **Next.js 16** (App Router) | Framework fullstack | API REST + UI dans un seul projet, déploiement simple |
| **Supabase** | BDD PostgreSQL + Auth + Storage | Gratuit, JWT géré, RLS intégré, Storage pour les photos |
| **Three.js / React Three Fiber** | Arbre 3D | Rendu WebGL, infini dans les 3 axes, bien plus lisible qu'un SVG 2D |
| **Tailwind CSS** | Styles | Rapidité de développement, pas de CSS à maintenir |
| **Zod** | Validation | Même schéma utilisable côté client et côté API |
| **React Hook Form** | Formulaires | Performances, intégration Zod native |
| **Jest + Testing Library** | Tests | Standard React, simple à configurer |
| **Vercel** | Déploiement | Intégration Next.js native, preview par PR |

**Architecture :** tout est dans un seul dépôt. Les routes `/api/*` sont des Route Handlers Next.js — c'est l'API REST. Les pages dans `app/(dashboard)/` sont les pages UI.

---

## 4. Authentification & Sécurité (1 min 30)

### Comment ça marche

Supabase Auth gère tout :
1. Inscription → email + mot de passe → email de confirmation
2. Connexion → Supabase retourne un **JWT signé (24h)**
3. Ce JWT est stocké dans des **cookies HTTP-only** (pas localStorage) — immunisé contre le vol XSS
4. `proxy.ts` (middleware Next.js) s'exécute sur **chaque requête** → vérifie la session, rafraîchit le JWT si nécessaire, redirige vers `/login` si pas connecté

### Les couches de sécurité

```
Requête utilisateur
    ↓
proxy.ts          → session valide ? sinon redirect /login
    ↓
Route API         → Zod valide le body
    ↓
getUserTreeRole() → quel est le rôle sur cet arbre ?
    ↓
canWrite() ?      → owner/admin/editor → OK | reader → 403
    ↓
Supabase RLS      → politiques PostgreSQL, dernier rempart
```

**3 niveaux de protection** : middleware serveur → vérification rôle applicatif → RLS base de données.

---

## 5. Système multi-arbres & partage (1 min)

Chaque utilisateur peut créer **plusieurs arbres** nommés et les partager — exactement comme Google Docs.

**4 rôles :**
- `owner` → tous les droits, peut supprimer l'arbre
- `admin` → peut modifier, supprimer des membres, gérer les accès
- `editor` → peut ajouter/modifier, pas supprimer
- `reader` → lecture seule

**En pratique :** toutes les routes API reçoivent un `treeId` en paramètre. Avant chaque écriture, on appelle `getUserTreeRole(supabase, treeId, userId)` qui interroge la table `tree_access`. Si le rôle n'est pas suffisant → 403.

---

## 6. Les fonctionnalités (2 min — montrer en live)

### Membres
- Fiche complète : prénom, nom, genre, date/lieu de naissance, décès, biographie, photo
- Upload photo stockée dans Supabase Storage
- Profil privé (`is_private`) — invisible aux autres utilisateurs

### Relations
- **Unions** : couple / mariage, avec date, et état séparé/divorcé
- **Parenté** : père, mère → génère les liens dans l'arbre 3D

### Historique
- Chaque modification d'un membre crée un **snapshot** en base (`member_history`)
- On peut voir le diff champ par champ et **restaurer** n'importe quelle version

### Import / Export
- Export JSON de l'arbre complet
- Import pour recréer un arbre depuis un fichier

### Statistiques
Tout est calculé côté API en JavaScript pur, sans librairie de graphiques :
- Pie chart genre → `conic-gradient` CSS inline
- Bar chart décennies → hauteur en `%` calculée dynamiquement
- Split bar vivants/décédés → flex avec largeurs en %

---

## 7. Focus technique — l'arbre 3D (3 min)

C'est la partie la plus complexe du projet. Voici comment ça fonctionne.

### Le principe général

L'arbre **n'est pas pré-calculé**. Il se construit **nœud par nœud à chaque clic**. Quand tu cliques sur une personne, l'algorithme va chercher ses parents, frères/sœurs, unions et enfants, puis les positionne en 3D autour d'elle.

```
Clic sur Marie
  → fetch /api/tree?person_id=marie_id&treeId=xxx
  → API retourne tous ses liens (parents, unions, enfants, fratrie)
  → algorithme de placement calcule les coordonnées [x, y, z]
  → React Three Fiber crée les sphères et les lignes
  → animation d'apparition (scale 0 → 1 en ~900ms)
```

### Représentation des données

Chaque nœud dans la scène 3D est soit :
- **Une personne** → sphère colorée par nom de famille (hash déterministe du nom → couleur HSL)
- **Un nœud union** → sphère avec picto ♥ / 💍 / 💔 — point intermédiaire entre les deux partenaires

Les liens sont des `<Line>` React Three Fiber (droites WebGL entre deux coordonnées).

### L'algorithme de placement

```
Axe Y = verticalité
  → Parents : y + 9 (au-dessus)
  → Enfants  : y - 9 (en-dessous)
  → Nœud union : y + 4.5 (entre les deux partenaires)

Axe X = horizontal (père à gauche, mère à droite)
  → père [-7, +9, z], mère [+7, +9, z]

Axe Z = profondeur (fratrie, partenaires multiples)
  → frères/sœurs décalés en Z
  → partenaires multiples placés en cercle (angle calculé)
```

**Anti-collision** : avant de placer un nœud, l'algo vérifie qu'aucun autre nœud n'est à moins de 7 unités. Si conflit, il cherche une position libre en spirale (anneaux de rayon 1, 2, 4, 8...).

### Pourquoi certains traits sont en diagonale

Le **V des parents** est volontaire :
```
père [-7, +9]      mère [+7, +9]
       \                /
        \              /
         union [0, +4.5]
               |
              moi [0, 0]
```
Père → union = diagonale (X et Y changent en même temps). C'est voulu, ça représente visuellement que les deux parents convergent.

Les diagonales inattendues viennent de l'anti-collision qui déplace un nœud de sa position idéale.

### Fonctionnalités de navigation 3D

- **Rotation / zoom / déplacement** → OrbitControls (React Three Fiber)
- **Vues prédéfinies** : dessus (Y↑), face (Z→), côté (X→) avec verrouillage d'axe
- **Undo Ctrl+Z** → annule la dernière expansion
- **Historique de navigation** → timeline des clics avec "Revenir ici"
- **Reset** → revient à la sphère initiale

---

## 8. Tests & CI/CD (30 sec)

**91 tests** répartis en 6 fichiers :

| Ce qui est testé | Nb |
|---|---|
| Schéma Zod membres (validation) | 15 |
| Composant MemberCard | 12 |
| Formulaire d'inscription | 9 |
| Classes CSS partagées | 6 |
| Rôles/permissions arbre | 17 |
| États d'union | 22 |

**GitHub Actions** sur chaque push → lint ESLint → tests Jest → build TypeScript → si tout passe, Vercel déploie automatiquement.

---

## 9. Ce que j'aurais fait avec plus de temps (30 sec)

- **Notifications en temps réel** quand un collaborateur modifie l'arbre (Supabase Realtime)
- **Export PDF / image** de l'arbre 3D
- **Mode présentation** → arbre en plein écran, caméra qui se déplace automatiquement
- **GEDCOM** → format standard généalogique, permettrait d'importer depuis Ancestry, MyHeritage etc.

---

## 10. Conclusion (30 sec)

> "En 3 semaines, j'ai livré une application fullstack déployée en production avec auth, multi-arbres, partage par rôles, visualisation 3D interactive, statistiques, historique des modifications, et une suite de 91 tests. L'approche MVP m'a permis d'avoir quelque chose qui tourne dès la fin de la semaine 1, et d'itérer dessus plutôt que de tout coder d'un coup et de ne jamais finir."

**Lien :** genea-sphere-lucas-j-mmi.vercel.app
**Repo :** github.com/LucasJ-MMI/GeneaSphere-LucasJ-MMI

---

## Timing suggéré

| Section | Durée |
|---|---|
| Accroche + démo rapide de la home | 1 min |
| Contexte & cahier des charges | 1 min |
| Approche MVP | 2 min |
| Stack technique | 1 min 30 |
| Auth & sécurité | 1 min 30 |
| Multi-arbres & partage | 1 min |
| Démo live des fonctionnalités | 2 min |
| Focus arbre 3D (algo) | 3 min |
| Tests & CI/CD | 30 sec |
| Ce qu'il manque + conclusion | 1 min |
| **Total** | **~15 min** |

---

## Questions probables & réponses

**"Pourquoi Supabase et pas une BDD custom ?"**
> Supabase c'est PostgreSQL avec une surcouche — j'ai accès à toute la puissance de SQL, les politiques RLS, les triggers. Et l'auth + storage intégrés m'ont fait gagner facilement une semaine de dev.

**"Pourquoi Three.js et pas D3.js comme demandé ?"**
> D3.js est excellent pour des graphiques 2D et des arbres SVG simples. Mais un arbre généalogique avec plusieurs centaines de membres en 2D devient vite illisible. La 3D donne un axe supplémentaire pour répartir les nœuds, et l'interaction (rotation, zoom) est bien plus intuitive pour naviguer dans une famille complexe.

**"Comment gères-tu les conflits quand deux personnes éditent en même temps ?"**
> Actuellement le dernier qui enregistre gagne — c'est un "last write wins". Pour résoudre ça proprement il faudrait des locks optimistes ou du temps réel avec Supabase Realtime, c'est dans ma liste pour la V2.

**"C'est quoi la RLS ?"**
> Row Level Security — c'est une fonctionnalité PostgreSQL. Au lieu de gérer les permissions uniquement dans le code applicatif, on définit des règles directement en base de données. Exemple : `SELECT * FROM members WHERE tree_id IN (SELECT tree_id FROM tree_access WHERE user_id = auth.uid())`. Même si quelqu'un forge une requête SQL directe, il ne voit que ce qu'il a le droit de voir.

**"Tu as codé tout ça seul ?"**
> Oui — 3 semaines, project solo. J'ai utilisé Claude Code (IA) pour accélérer certaines parties répétitives (formulaires, styles), mais toute l'architecture, les choix techniques, et l'algorithme de l'arbre 3D sont les miens.
