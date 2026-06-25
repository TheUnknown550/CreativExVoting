-- Cap the length of the free-text project fields so judges and admins see
-- consistently sized write-ups. Existing rows that already exceed the new
-- limits are truncated before the CHECK constraints are added.

UPDATE projects SET short_description = LEFT(short_description, 1500) WHERE char_length(short_description) > 1500;
UPDATE projects SET full_description = LEFT(full_description, 2500) WHERE char_length(full_description) > 2500;
UPDATE projects SET concept = LEFT(concept, 2500) WHERE char_length(concept) > 2500;

ALTER TABLE projects
    ADD CONSTRAINT projects_short_description_length CHECK (char_length(short_description) <= 1500),
    ADD CONSTRAINT projects_full_description_length CHECK (char_length(full_description) <= 2500),
    ADD CONSTRAINT projects_concept_length CHECK (char_length(concept) <= 2500);
