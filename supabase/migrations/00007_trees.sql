-- ── 1. Tables ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trees (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  owner_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tree_access (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id    UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('reader', 'editor', 'admin')),
  granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tree_id, user_id)
);

-- ── 2. Colonnes tree_id sur les tables existantes ─────────────────────
ALTER TABLE members ADD COLUMN IF NOT EXISTS tree_id UUID REFERENCES trees(id) ON DELETE CASCADE;
ALTER TABLE spouses ADD COLUMN IF NOT EXISTS tree_id UUID REFERENCES trees(id) ON DELETE CASCADE;

-- ── 3. Migration données existantes ──────────────────────────────────
-- Un arbre par défaut par utilisateur (basé sur les membres existants)
INSERT INTO trees (name, owner_id)
SELECT DISTINCT 'Mon arbre', m.created_by
FROM members m
WHERE m.created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM trees t WHERE t.owner_id = m.created_by);

-- Rattacher les membres à l'arbre de leur créateur
UPDATE members m
SET tree_id = t.id
FROM trees t
WHERE t.owner_id = m.created_by
  AND m.tree_id IS NULL;

-- Rattacher les unions à l'arbre du premier membre
UPDATE spouses s
SET tree_id = (
  SELECT m.tree_id FROM members m WHERE m.id = s.member1_id LIMIT 1
)
WHERE s.tree_id IS NULL;

-- ── 4. RLS ────────────────────────────────────────────────────────────
ALTER TABLE trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tree_access ENABLE ROW LEVEL SECURITY;

-- trees : lecture (propriétaire ou accès accordé)
CREATE POLICY "trees_select" ON trees FOR SELECT USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM tree_access WHERE tree_id = trees.id AND user_id = auth.uid())
);

-- trees : insertion (seulement pour soi-même)
CREATE POLICY "trees_insert" ON trees FOR INSERT WITH CHECK (owner_id = auth.uid());

-- trees : mise à jour (propriétaire ou admin)
CREATE POLICY "trees_update" ON trees FOR UPDATE USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM tree_access
    WHERE tree_id = trees.id AND user_id = auth.uid() AND role = 'admin'
  )
);

-- trees : suppression (propriétaire uniquement)
CREATE POLICY "trees_delete" ON trees FOR DELETE USING (owner_id = auth.uid());

-- tree_access : lecture
CREATE POLICY "tree_access_select" ON tree_access FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM trees WHERE id = tree_access.tree_id AND owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM tree_access ta2
    WHERE ta2.tree_id = tree_access.tree_id
      AND ta2.user_id = auth.uid()
      AND ta2.role = 'admin'
  )
);

-- tree_access : insertion (propriétaire ou admin)
CREATE POLICY "tree_access_insert" ON tree_access FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM trees WHERE id = tree_access.tree_id AND owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM tree_access ta
    WHERE ta.tree_id = tree_access.tree_id
      AND ta.user_id = auth.uid()
      AND ta.role = 'admin'
  )
);

-- tree_access : mise à jour (propriétaire ou admin)
CREATE POLICY "tree_access_update" ON tree_access FOR UPDATE USING (
  EXISTS (SELECT 1 FROM trees WHERE id = tree_access.tree_id AND owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM tree_access ta
    WHERE ta.tree_id = tree_access.tree_id
      AND ta.user_id = auth.uid()
      AND ta.role = 'admin'
  )
);

-- tree_access : suppression (propriétaire ou admin)
CREATE POLICY "tree_access_delete" ON tree_access FOR DELETE USING (
  EXISTS (SELECT 1 FROM trees WHERE id = tree_access.tree_id AND owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM tree_access ta
    WHERE ta.tree_id = tree_access.tree_id
      AND ta.user_id = auth.uid()
      AND ta.role = 'admin'
  )
);
