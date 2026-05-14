-- ====================================================================
-- Phase 2X.1.7 — Candidate Ranking Fix (Reserved-A weight design)
-- ====================================================================
-- Three SQL blocks in this file. Paste each separately in Supabase SQL
-- Editor, in the order shown. Run one at a time so failures are easy
-- to isolate.
-- ====================================================================


-- ─── BLOCK 1: New candidates_search_update() trigger function ─────────
-- WEIGHT MAP (new):
--   A: candidate_summary (FUTURE — column does not yet exist, intentionally omitted)
--   B: work_history (aggregated job_title + company_name + description)
--   C: current_title, current_company, headline, certifications, category, skills
--   D: first_name, last_name, location_city, location_state
--
-- Multipliers (applied in hybrid_search via custom ts_rank weights):
--   D=0.05, C=0.4, B=0.6, A=1.0
--
-- This replaces the prior trigger which had names at A, titles/skills at B,
-- and location+work_history at C.

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
    -- Weight A (1.0): RESERVED for future candidate_summary column.
    -- When candidate_summary is added, prepend:
    --   SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.candidate_summary, '')), 'A') ||
    --
    -- Weight B (0.6): work_history (the substance)
    SETWEIGHT(TO_TSVECTOR('english', v_work_history_text), 'B') ||
    -- Weight C (0.4): current role + skills + certs + category
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.current_title, '')), 'C') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.current_company, '')), 'C') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.headline, '')), 'C') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.certifications, '')), 'C') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.category, '')), 'C') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.skills, '')), 'C') ||
    -- Weight D (0.05): names + location (noise floor)
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.first_name, '')), 'D') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.last_name, '')), 'D') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.location_city, '')), 'D') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.location_state, '')), 'D');
  RETURN NEW;
END;
$function$;


-- ─── BLOCK 2: New hybrid_search() RPC ─────────────────────────────────
-- CHANGES from current:
--   (a) Signature: result_limit DEFAULT 150 → 75 (revert Phase 2X.1.5)
--   (b) Candidate semantic LIMIT 150 → 50 (revert Phase 2X.1.5)
--   (c) Candidate keyword branch ts_rank gets custom weights
--       '{0.05, 0.4, 0.6, 1.0}'::float4[] in BOTH the SELECT clause AND
--       the ORDER BY clause.
--   (d) Company, contact, note branches UNCHANGED — they keep default
--       ts_rank weights {0.1, 0.2, 0.4, 1.0}.
--   (e) Phase 2X.1.6 OR-based tsquery construction PRESERVED.

CREATE OR REPLACE FUNCTION public.hybrid_search(query_embedding vector, query_text text, include_notes boolean DEFAULT false, result_limit integer DEFAULT 75, filter_entity_type text DEFAULT NULL::text)
 RETURNS TABLE(entity_type text, entity_id uuid, entity_name text, snippet text, result_type text, similarity_score double precision, keyword_rank double precision, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  tsq tsquery;
BEGIN
  -- Build tsquery only when query_text is non-blank.
  -- NULL tsq causes all keyword branches to return 0 rows (WHERE tsq IS NOT NULL).
  IF query_text IS NOT NULL AND trim(query_text) <> '' THEN
    -- Phase 2X.1.6 (Lever B): convert AND-based plainto_tsquery to
    -- OR-based, letting candidates match on ANY query token rather than
    -- requiring ALL. Fixes recall for candidates missing recruiter-
    -- framing tokens like "presales", "experience", "lives", "midwest".
    -- ts_rank still ranks within each keyword branch, so candidates
    -- matching more tokens still surface first.
    tsq := replace(
      plainto_tsquery('english', query_text)::text,
      ' & ',
      ' | '
    )::tsquery;
  END IF;

  RETURN QUERY
  WITH raw AS (

    -- ── CANDIDATES: semantic ──────────────────────────────────────────────
    (
      SELECT
        'candidate'::text                                                AS entity_type,
        c.id                                                             AS entity_id,
        (c.first_name || ' ' || c.last_name)::text                      AS entity_name,
        CASE
          WHEN tsq IS NOT NULL THEN
            ts_headline('english',
              COALESCE(c.current_title, '') || ' at ' || COALESCE(c.current_company, ''),
              tsq, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')
          ELSE
            LEFT(COALESCE(c.headline, c.current_title, ''), 200)
        END::text                                                        AS snippet,
        'semantic'::text                                                 AS _half,
        (1.0 - (c.embedding <=> query_embedding))::float                AS similarity_score,
        0::float                                                         AS keyword_rank,
        c.created_at
      FROM candidates c
      WHERE c.embedding IS NOT NULL
        AND (filter_entity_type IS NULL OR filter_entity_type = 'candidate')
      ORDER BY c.embedding <=> query_embedding
      LIMIT 50
    )

    UNION ALL

    -- ── CANDIDATES: keyword ───────────────────────────────────────────────
    -- Phase 2X.1.7: custom ts_rank weights {D=0.05, C=0.4, B=0.6, A=1.0}
    -- applied here. This is the ranking fix.
    -- NOTE: no "embedding IS NOT NULL" filter here — brand-new records without
    -- an embedding (pending nightly cron backfill) must still be keyword-findable.
    (
      SELECT
        'candidate'::text,
        c.id,
        (c.first_name || ' ' || c.last_name)::text,
        ts_headline('english',
          COALESCE(c.current_title, '') || ' at ' || COALESCE(c.current_company, ''),
          tsq, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::text,
        'keyword'::text,
        0::float,
        ts_rank('{0.05, 0.4, 0.6, 1.0}'::float4[], c.search_vector, tsq)::float,
        c.created_at
      FROM candidates c
      WHERE tsq IS NOT NULL
        AND c.search_vector @@ tsq
        AND (filter_entity_type IS NULL OR filter_entity_type = 'candidate')
      ORDER BY ts_rank('{0.05, 0.4, 0.6, 1.0}'::float4[], c.search_vector, tsq) DESC
      LIMIT 50
    )

    UNION ALL

    -- ── COMPANIES: semantic ───────────────────────────────────────────────
    (
      SELECT
        'company'::text,
        co.id,
        co.name::text,
        CASE
          WHEN tsq IS NOT NULL THEN
            ts_headline('english',
              co.name || ' ' || COALESCE(co.industry, ''),
              tsq, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')
          ELSE
            LEFT(COALESCE(co.what_they_do, co.name), 200)
        END::text,
        'semantic'::text,
        (1.0 - (co.embedding <=> query_embedding))::float,
        0::float,
        co.created_at
      FROM companies co
      WHERE co.embedding IS NOT NULL
        AND (filter_entity_type IS NULL OR filter_entity_type = 'company')
      ORDER BY co.embedding <=> query_embedding
      LIMIT 25
    )

    UNION ALL

    -- ── COMPANIES: keyword ────────────────────────────────────────────────
    (
      SELECT
        'company'::text,
        co.id,
        co.name::text,
        ts_headline('english',
          co.name || ' ' || COALESCE(co.industry, ''),
          tsq, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::text,
        'keyword'::text,
        0::float,
        ts_rank(co.search_vector, tsq)::float,
        co.created_at
      FROM companies co
      WHERE tsq IS NOT NULL
        AND co.search_vector @@ tsq
        AND (filter_entity_type IS NULL OR filter_entity_type = 'company')
      ORDER BY ts_rank(co.search_vector, tsq) DESC
      LIMIT 25
    )

    UNION ALL

    -- ── COMPANY CONTACTS: semantic ────────────────────────────────────────
    (
      SELECT
        'contact'::text,
        cc.id,
        (cc.first_name || ' ' || cc.last_name)::text,
        CASE
          WHEN tsq IS NOT NULL THEN
            ts_headline('english',
              cc.first_name || ' ' || cc.last_name || ' ' || COALESCE(cc.title, ''),
              tsq, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')
          ELSE
            LEFT(COALESCE(cc.title, cc.first_name || ' ' || cc.last_name), 200)
        END::text,
        'semantic'::text,
        (1.0 - (cc.embedding <=> query_embedding))::float,
        0::float,
        cc.created_at
      FROM company_contacts cc
      WHERE cc.embedding IS NOT NULL
        AND (filter_entity_type IS NULL OR filter_entity_type = 'contact')
      ORDER BY cc.embedding <=> query_embedding
      LIMIT 25
    )

    UNION ALL

    -- ── COMPANY CONTACTS: keyword ─────────────────────────────────────────
    (
      SELECT
        'contact'::text,
        cc.id,
        (cc.first_name || ' ' || cc.last_name)::text,
        ts_headline('english',
          cc.first_name || ' ' || cc.last_name || ' ' || COALESCE(cc.title, ''),
          tsq, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::text,
        'keyword'::text,
        0::float,
        ts_rank(cc.search_vector, tsq)::float,
        cc.created_at
      FROM company_contacts cc
      WHERE tsq IS NOT NULL
        AND cc.search_vector @@ tsq
        AND (filter_entity_type IS NULL OR filter_entity_type = 'contact')
      ORDER BY ts_rank(cc.search_vector, tsq) DESC
      LIMIT 25
    )

    UNION ALL

    -- ── NOTES: semantic (only when include_notes = true) ──────────────────
    (
      SELECT
        'note'::text,
        n.id,
        (LEFT(n.content, 60) ||
          CASE WHEN length(n.content) > 60 THEN '...' ELSE '' END)::text,
        CASE
          WHEN tsq IS NOT NULL THEN
            ts_headline('english', n.content,
              tsq, 'MaxWords=35, MinWords=15, StartSel=**, StopSel=**')
          ELSE
            LEFT(n.content, 200)
        END::text,
        'semantic'::text,
        (1.0 - (n.embedding <=> query_embedding))::float,
        0::float,
        n.created_at
      FROM notes n
      WHERE include_notes
        AND n.embedding IS NOT NULL
        AND (n.is_private = false OR n.created_by = auth.uid())
        AND (filter_entity_type IS NULL OR filter_entity_type = 'note')
      ORDER BY n.embedding <=> query_embedding
      LIMIT 25
    )

    UNION ALL

    -- ── NOTES: keyword (only when include_notes = true) ───────────────────
    (
      SELECT
        'note'::text,
        n.id,
        (LEFT(n.content, 60) ||
          CASE WHEN length(n.content) > 60 THEN '...' ELSE '' END)::text,
        ts_headline('english', n.content,
          tsq, 'MaxWords=35, MinWords=15, StartSel=**, StopSel=**')::text,
        'keyword'::text,
        0::float,
        ts_rank(n.search_vector, tsq)::float,
        n.created_at
      FROM notes n
      WHERE include_notes
        AND tsq IS NOT NULL
        AND n.search_vector @@ tsq
        AND (n.is_private = false OR n.created_by = auth.uid())
        AND (filter_entity_type IS NULL OR filter_entity_type = 'note')
      ORDER BY ts_rank(n.search_vector, tsq) DESC
      LIMIT 25
    )

  ),

  -- ── DEDUPLICATION ─────────────────────────────────────────────────────────
  -- The same entity_id may appear in both semantic and keyword halves.
  -- Collapse to one row per (entity_type, entity_id):
  --   • result_type = 'both' if it matched in both halves
  --   • snippet prefers the keyword-half (has ts_headline highlights); falls
  --     back to the semantic-half snippet when no keyword row exists
  --   • similarity_score and keyword_rank each take the MAX across halves
  deduped AS (
    SELECT
      r.entity_type,
      r.entity_id,
      MAX(r.entity_name)                                                 AS entity_name,
      COALESCE(
        MAX(CASE WHEN r._half = 'keyword'  THEN r.snippet END),
        MAX(CASE WHEN r._half = 'semantic' THEN r.snippet END)
      )                                                                  AS snippet,
      CASE
        WHEN bool_or(r._half = 'keyword') AND bool_or(r._half = 'semantic')
          THEN 'both'
        WHEN bool_or(r._half = 'keyword')
          THEN 'keyword'
        ELSE
          'semantic'
      END                                                                AS result_type,
      MAX(r.similarity_score)                                            AS similarity_score,
      MAX(r.keyword_rank)                                                AS keyword_rank,
      MAX(r.created_at)                                                  AS created_at
    FROM raw r
    GROUP BY r.entity_type, r.entity_id
  )

  SELECT
    d.entity_type,
    d.entity_id,
    d.entity_name,
    d.snippet,
    d.result_type,
    d.similarity_score,
    d.keyword_rank,
    d.created_at
  FROM deduped d
  ORDER BY greatest(d.similarity_score, d.keyword_rank) DESC
  LIMIT result_limit;

END;
$function$;


-- ─── BLOCK 3: Backfill candidates.search_vector ──────────────────────
-- WHY: BLOCK 1 updated the trigger function, but the existing ~5,766
-- candidate rows still have search_vector built under the OLD weight
-- map (names at A). This UPDATE fires candidates_search_trigger for
-- every row, which calls the NEW candidates_search_update() and rebuilds
-- search_vector with the new weights.
--
-- IMPORTANT: This does NOT null embedding_updated_at because no trigger
-- on the candidates table touches that column (verified in Phase 2X.1.7
-- recon — embedding_updated_at is managed by application code, not by
-- any DB trigger). Embeddings remain untouched.
--
-- Approx ~5,766 rows. Should take a few seconds.

UPDATE candidates SET updated_at = NOW();
