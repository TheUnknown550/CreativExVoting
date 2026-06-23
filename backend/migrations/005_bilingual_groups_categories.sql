-- Bilingual support for the judge-facing award hierarchy. The existing
-- name/description columns hold the English (default) value; the *_th columns
-- hold Thai. The frontend picks by the active locale and falls back to the
-- other language when one side is empty.

ALTER TABLE award_groups ADD COLUMN IF NOT EXISTS name_th TEXT;
ALTER TABLE award_groups ADD COLUMN IF NOT EXISTS description_th TEXT;

ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_th TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description_th TEXT;
