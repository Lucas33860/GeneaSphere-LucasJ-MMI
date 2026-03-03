-- Historique des modifications des membres
CREATE TABLE member_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id   UUID NOT NULL,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  gender      TEXT,
  birth_date  DATE,
  death_date  DATE,
  birth_place TEXT,
  photo_url   TEXT,
  bio         TEXT,
  is_private  BOOLEAN,
  father_id   UUID,
  mother_id   UUID,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('create','update','delete'))
);

ALTER TABLE member_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "history_select" ON member_history FOR SELECT
  USING (
    changed_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
  );

CREATE POLICY "history_insert" ON member_history FOR INSERT
  WITH CHECK (changed_by = auth.uid());
