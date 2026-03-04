-- Fix récursion infinie dans les policies RLS de trees/tree_access
-- Les policies se référençaient mutuellement → infinite recursion (code 42P17)
-- Solution : fonctions SECURITY DEFINER qui bypassent le RLS

-- ── 1. Supprimer les policies problématiques ──────────────────────
DROP POLICY IF EXISTS "trees_select"       ON trees;
DROP POLICY IF EXISTS "trees_insert"       ON trees;
DROP POLICY IF EXISTS "trees_update"       ON trees;
DROP POLICY IF EXISTS "trees_delete"       ON trees;
DROP POLICY IF EXISTS "tree_access_select" ON tree_access;
DROP POLICY IF EXISTS "tree_access_insert" ON tree_access;
DROP POLICY IF EXISTS "tree_access_update" ON tree_access;
DROP POLICY IF EXISTS "tree_access_delete" ON tree_access;

-- ── 2. Fonctions SECURITY DEFINER (bypassent le RLS) ─────────────
CREATE OR REPLACE FUNCTION _has_tree_access(p_tree_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM tree_access WHERE tree_id = p_tree_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION _owns_tree(p_tree_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM trees WHERE id = p_tree_id AND owner_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION _is_tree_admin(p_tree_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM tree_access
    WHERE tree_id = p_tree_id AND user_id = p_user_id AND role = 'admin'
  );
$$;

-- ── 3. Policies trees ─────────────────────────────────────────────
CREATE POLICY "trees_select" ON trees FOR SELECT USING (
  owner_id = auth.uid() OR _has_tree_access(id, auth.uid())
);
CREATE POLICY "trees_insert" ON trees FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "trees_update" ON trees FOR UPDATE USING (
  owner_id = auth.uid() OR _is_tree_admin(id, auth.uid())
);
CREATE POLICY "trees_delete" ON trees FOR DELETE USING (owner_id = auth.uid());

-- ── 4. Policies tree_access ───────────────────────────────────────
CREATE POLICY "tree_access_select" ON tree_access FOR SELECT USING (
  user_id = auth.uid()
  OR _owns_tree(tree_id, auth.uid())
  OR _is_tree_admin(tree_id, auth.uid())
);
CREATE POLICY "tree_access_insert" ON tree_access FOR INSERT WITH CHECK (
  _owns_tree(tree_id, auth.uid()) OR _is_tree_admin(tree_id, auth.uid())
);
CREATE POLICY "tree_access_update" ON tree_access FOR UPDATE USING (
  _owns_tree(tree_id, auth.uid()) OR _is_tree_admin(tree_id, auth.uid())
);
CREATE POLICY "tree_access_delete" ON tree_access FOR DELETE USING (
  _owns_tree(tree_id, auth.uid()) OR _is_tree_admin(tree_id, auth.uid())
);
