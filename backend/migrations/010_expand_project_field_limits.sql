ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_short_description_length;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_full_description_length;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_concept_length;

ALTER TABLE projects
    ADD CONSTRAINT projects_short_description_length CHECK (char_length(short_description) <= 6000),
    ADD CONSTRAINT projects_full_description_length CHECK (char_length(full_description) <= 7000),
    ADD CONSTRAINT projects_concept_length CHECK (char_length(concept) <= 6000);
