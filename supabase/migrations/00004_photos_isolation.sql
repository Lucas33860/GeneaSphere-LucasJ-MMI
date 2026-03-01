-- Migration 00004 : isolation des données par utilisateur + photos membres

-- ============================================================
-- 1. Bucket de stockage pour les photos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('member-photos', 'member-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique (les URLs sont publiques)
CREATE POLICY "member_photos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'member-photos');

-- Upload : utilisateur authentifié, dans son propre dossier
CREATE POLICY "member_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'member-photos' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Suppression : uniquement ses propres fichiers
CREATE POLICY "member_photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'member-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 2. Isolation des membres : chaque user ne voit que les siens
-- ============================================================
DROP POLICY IF EXISTS "members_select" ON public.members;

CREATE POLICY "members_select" ON public.members
  FOR SELECT USING (
    created_by = auth.uid() OR
    exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin)
  );

-- ============================================================
-- 3. Spouses — ajouter created_by + policies d'isolation
-- ============================================================
ALTER TABLE public.spouses
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "spouses_select" ON public.spouses;
DROP POLICY IF EXISTS "spouses_insert" ON public.spouses;
DROP POLICY IF EXISTS "spouses_delete" ON public.spouses;
-- Supprimer d'éventuelles policies update ajoutées par 00002
DROP POLICY IF EXISTS "spouses_update" ON public.spouses;

CREATE POLICY "spouses_select" ON public.spouses
  FOR SELECT USING (
    created_by = auth.uid() OR
    exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin)
  );

CREATE POLICY "spouses_insert" ON public.spouses
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved)
  );

CREATE POLICY "spouses_update" ON public.spouses
  FOR UPDATE USING (
    created_by = auth.uid() OR
    exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin)
  );

CREATE POLICY "spouses_delete" ON public.spouses
  FOR DELETE USING (
    created_by = auth.uid() OR
    exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin)
  );
