ALTER TABLE spouses
  ADD COLUMN union_type TEXT NOT NULL DEFAULT 'marriage'
  CHECK (union_type IN ('couple', 'marriage'));
