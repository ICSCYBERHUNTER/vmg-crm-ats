-- Add optional secondary entity link to follow_ups.
-- A task can be "about" a primary entity but also associated with a secondary one.
-- Example: a task primarily on a job_opening but linked to a candidate as secondary.

ALTER TABLE follow_ups
  ADD COLUMN secondary_entity_type TEXT
    CHECK (secondary_entity_type IN ('candidate', 'company', 'company_contact', 'job_opening')),
  ADD COLUMN secondary_entity_id UUID;

CREATE INDEX idx_follow_ups_secondary
  ON follow_ups(secondary_entity_type, secondary_entity_id)
  WHERE secondary_entity_id IS NOT NULL;
