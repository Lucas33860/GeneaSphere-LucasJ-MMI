-- Fix RLS membres/spouses pour les arbres partagés
-- Problème : members_select/spouses_select filtraient sur created_by = auth.uid()
-- → les utilisateurs avec accès à un arbre partagé ne voyaient rien
-- Solution : autoriser la lecture si l'utilisateur a accès à l'arbre (via _has_tree_access)

-- ── members ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members_select" ON public.members;
DROP POLICY IF EXISTS "members_insert" ON public.members;
DROP POLICY IF EXISTS "members_update" ON public.members;
DROP POLICY IF EXISTS "members_delete" ON public.members;

CREATE POLICY "members_select" ON public.members
  FOR SELECT USING (
    created_by = auth.uid()
    OR exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin)
    OR (tree_id IS NOT NULL AND (
      _owns_tree(tree_id, auth.uid()) OR _has_tree_access(tree_id, auth.uid())
    ))
  );

CREATE POLICY "members_insert" ON public.members
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved)
  );

CREATE POLICY "members_update" ON public.members
  FOR UPDATE USING (
    created_by = auth.uid()
    OR exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin)
    OR (tree_id IS NOT NULL AND (
      _owns_tree(tree_id, auth.uid()) OR _has_tree_access(tree_id, auth.uid())
    ))
  );

CREATE POLICY "members_delete" ON public.members
  FOR DELETE USING (
    created_by = auth.uid()
    OR exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin)
    OR (tree_id IS NOT NULL AND (
      _owns_tree(tree_id, auth.uid()) OR _is_tree_admin(tree_id, auth.uid())
    ))
  );

-- ── spouses ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "spouses_select" ON public.spouses;
DROP POLICY IF EXISTS "spouses_insert" ON public.spouses;
DROP POLICY IF EXISTS "spouses_update" ON public.spouses;
DROP POLICY IF EXISTS "spouses_delete" ON public.spouses;

CREATE POLICY "spouses_select" ON public.spouses
  FOR SELECT USING (
    created_by = auth.uid()
    OR exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin)
    OR (tree_id IS NOT NULL AND (
      _owns_tree(tree_id, auth.uid()) OR _has_tree_access(tree_id, auth.uid())
    ))
  );

CREATE POLICY "spouses_insert" ON public.spouses
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved)
  );

CREATE POLICY "spouses_update" ON public.spouses
  FOR UPDATE USING (
    created_by = auth.uid()
    OR exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin)
    OR (tree_id IS NOT NULL AND (
      _owns_tree(tree_id, auth.uid()) OR _has_tree_access(tree_id, auth.uid())
    ))
  );

CREATE POLICY "spouses_delete" ON public.spouses
  FOR DELETE USING (
    created_by = auth.uid()
    OR exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin)
    OR (tree_id IS NOT NULL AND (
      _owns_tree(tree_id, auth.uid()) OR _is_tree_admin(tree_id, auth.uid())
    ))
  );

-- Note : la table parentage a été supprimée en 00003.
-- Les parentés (father_id/mother_id) sont des colonnes sur la table members,
-- donc elles sont déjà couvertes par les policies members ci-dessus.
