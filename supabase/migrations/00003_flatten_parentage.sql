-- Migration 00003 : déplacer father_id / mother_id de la table parentage
-- vers des colonnes directes sur members, puis supprimer parentage.

-- 1. Ajouter les colonnes
ALTER TABLE members
  ADD COLUMN father_id UUID REFERENCES members(id) ON DELETE SET NULL,
  ADD COLUMN mother_id UUID REFERENCES members(id) ON DELETE SET NULL;

-- 2. Migrer les données existantes
UPDATE members m
SET
  father_id = p.father_id,
  mother_id = p.mother_id
FROM parentage p
WHERE p.child_id = m.id;

-- 3. Supprimer l'ancienne table (ses policies RLS disparaissent avec)
DROP TABLE IF EXISTS parentage;
