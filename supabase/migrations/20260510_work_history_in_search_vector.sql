------------------------------------------------------------------------------
-- Migration: Work history aggregated text into candidates.search_vector
-- Date: 2026-05-10
--
-- Purpose:
--   (1) Modify candidates_search_update() to aggregate work_history text
--       (description, job_title, company_name) at weight C.
--   (2) Add propagation trigger on work_history that re-fires the parent
--       candidate's search_vector update on any INSERT/UPDATE/DELETE.
--   (3) Backfill: force search_vector recomputation across all 5,766 existing
--       candidates so they pick up the new logic.
--
-- Coexistence notes:
--   - This DB trigger handles search_vector (keyword search).
--   - The application-layer null-and-wait in src/lib/supabase/work-history.ts
--     handles embedding_updated_at (semantic search). They touch different
--     columns and DO NOT conflict.
--   - sync_current_position() already issues UPDATE candidates on work_history
--     changes. After this migration, that UPDATE plus our new propagation
--     UPDATE will both fire candidates_search_update(). Double recomputation
--     cost is ~1ms per save; final state is identical.
------------------------------------------------------------------------------

-- ==========================================================================
-- STEP 1 OF 3: Modify candidates_search_update() to include work_history
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.candidates_search_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_work_history_text TEXT;
BEGIN
  -- Aggregate work_history rows for this candidate.
  -- On INSERT of a new candidate, no work_history rows exist yet → empty string.
  SELECT COALESCE(
    STRING_AGG(
      COALESCE(job_title, '') || ' ' ||
      COALESCE(company_name, '') || ' ' ||
      COALESCE(description, ''),
      ' '
    ),
    ''
  )
  INTO v_work_history_text
  FROM work_history
  WHERE candidate_id = NEW.id;

  NEW.search_vector :=
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.first_name, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.last_name, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.current_title, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.current_company, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.headline, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.certifications, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.category, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.skills, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.location_city, '')), 'C') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.location_state, '')), 'C') ||
    SETWEIGHT(TO_TSVECTOR('english', v_work_history_text), 'C');
  RETURN NEW;
END;
$function$;

-- ==========================================================================
-- STEP 2 OF 3: Propagation trigger — work_history changes touch parent
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.work_history_propagate_to_candidate()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Touch parent candidate's updated_at. This fires candidates_search_trigger
  -- (BEFORE UPDATE on all columns), which recomputes search_vector including
  -- the new/updated/deleted work_history row.
  --
  -- DO NOT touch embedding_updated_at here — that's the application layer's
  -- job (work-history.ts). Setting it here would interfere with the null-and-
  -- wait coordination.
  UPDATE candidates
  SET updated_at = now()
  WHERE id = COALESCE(NEW.candidate_id, OLD.candidate_id);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE TRIGGER work_history_propagate_search_vector
AFTER INSERT OR UPDATE OR DELETE ON work_history
FOR EACH ROW
EXECUTE FUNCTION work_history_propagate_to_candidate();

-- ==========================================================================
-- STEP 3 OF 3: One-shot backfill — recompute all 5,766 candidates
-- ==========================================================================

-- Setting id = id is a no-op data-wise but fires the BEFORE UPDATE trigger
-- (verified: candidates_search_trigger has no UPDATE OF restriction).
-- Side effect: bumps updated_at for all rows via set_updated_at trigger.
-- This is acceptable — no downstream system depends on updated_at as a
-- "real change" indicator.
--
-- Expected runtime: 30-90 seconds for 5,766 rows. If the SQL Editor times out,
-- run in batches (see fallback below).

UPDATE candidates SET id = id WHERE TRUE;

-- Fallback if the single UPDATE hangs or times out — comment-only, NOT to run
-- unless needed:
-- DO $$
-- DECLARE
--   v_batch_size INT := 500;
--   v_total INT;
-- BEGIN
--   FOR i IN 0..((SELECT count(*) FROM candidates) / v_batch_size) LOOP
--     UPDATE candidates SET id = id
--     WHERE id IN (
--       SELECT id FROM candidates ORDER BY id LIMIT v_batch_size OFFSET (i * v_batch_size)
--     );
--   END LOOP;
-- END $$;
------------------------------------------------------------------------------
