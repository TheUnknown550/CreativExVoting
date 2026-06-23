-- Introduce a two-level award hierarchy:
--   award_groups (หมวด, superset) -> categories (สาขา, subset)
-- and move judge access to the group level so a judge scores every
-- sub-category project inside their assigned award group(s).

CREATE TABLE IF NOT EXISTS award_groups (
    id UUID PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS award_group_id UUID REFERENCES award_groups(id);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS judge_group_assignments (
    id UUID PRIMARY KEY,
    judge_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES award_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (judge_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_categories_award_group_id ON categories(award_group_id);
CREATE INDEX IF NOT EXISTS idx_group_assignments_judge_id ON judge_group_assignments(judge_id);
CREATE INDEX IF NOT EXISTS idx_group_assignments_group_id ON judge_group_assignments(group_id);
