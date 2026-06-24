-- Bilingual scoring criteria: name/description hold English (default), the *_th
-- columns hold Thai. The frontend picks by the active locale and falls back to
-- the other language when one side is empty.

ALTER TABLE scoring_criteria ADD COLUMN IF NOT EXISTS name_th TEXT;
ALTER TABLE scoring_criteria ADD COLUMN IF NOT EXISTS description_th TEXT;
