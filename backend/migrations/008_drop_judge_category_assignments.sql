-- judge_category_assignments was superseded by judge_group_assignments when
-- judge access moved from per-category to per-award-group (see
-- 004_award_groups.sql). No application code reads or writes this table
-- anymore; it only still held stale rows from before that migration.

DROP TABLE IF EXISTS judge_category_assignments;
