-- ============================================================
-- GeneaSphere — Fix RLS : politiques UPDATE manquantes
-- ============================================================

-- spouses : UPDATE autorisé pour les utilisateurs approuvés
drop policy if exists "spouses_update" on public.spouses;
create policy "spouses_update" on public.spouses
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_approved)
  );

-- parentage : UPDATE autorisé pour les utilisateurs approuvés
drop policy if exists "parentage_update" on public.parentage;
create policy "parentage_update" on public.parentage
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_approved)
  );

-- Fix DELETE policies : ouvrir aux utilisateurs approuvés (pas seulement admin)
drop policy if exists "parentage_delete" on public.parentage;
create policy "parentage_delete" on public.parentage
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_approved)
  );

drop policy if exists "spouses_delete" on public.spouses;
create policy "spouses_delete" on public.spouses
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_approved)
  );
