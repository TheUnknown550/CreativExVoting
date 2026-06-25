-- proposal_link and attached_file_link were captured in the admin form and
-- stored on every project, but no judge-facing page ever displayed them
-- (only the unused ProjectVoteDrawer component referenced them). Dropping
-- them to stop storing data nobody can see.

ALTER TABLE projects DROP COLUMN IF EXISTS proposal_link;
ALTER TABLE projects DROP COLUMN IF EXISTS attached_file_link;
