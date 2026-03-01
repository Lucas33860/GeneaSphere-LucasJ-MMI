-- Migration 00005 : auto-approbation des nouveaux inscrits
-- Chaque utilisateur peut gérer son propre arbre sans validation admin.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_first boolean;
BEGIN
  SELECT count(*) = 0 INTO is_first FROM public.profiles;

  INSERT INTO public.profiles (id, email, full_name, is_admin, is_approved)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    is_first,  -- premier inscrit = admin
    true       -- tous les inscrits sont approuvés automatiquement
  );
  RETURN new;
END;
$$;
