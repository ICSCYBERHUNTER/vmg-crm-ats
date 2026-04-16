-- Companies
ALTER TABLE companies
  ADD COLUMN referred_by_type TEXT
    CHECK (referred_by_type IN ('contact', 'candidate')),
  ADD COLUMN referred_by_id UUID,
  ADD COLUMN referred_by_text TEXT;

CREATE INDEX idx_companies_referred_by
  ON companies(referred_by_type, referred_by_id)
  WHERE referred_by_id IS NOT NULL;

-- Candidates
ALTER TABLE candidates
  ADD COLUMN referred_by_type TEXT
    CHECK (referred_by_type IN ('contact', 'candidate')),
  ADD COLUMN referred_by_id UUID,
  ADD COLUMN referred_by_text TEXT;

CREATE INDEX idx_candidates_referred_by
  ON candidates(referred_by_type, referred_by_id)
  WHERE referred_by_id IS NOT NULL;
