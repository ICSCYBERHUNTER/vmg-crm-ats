-- Phase 2X.1.7: Revert Phase 2X.1.5 pool widening (keep Phase 2X.1.6 OR tsquery)
-- Date: 2026-05-12
--
-- Phase 2X.1.5 widened the candidate semantic branch from LIMIT 50 to 150
-- and the result_limit default from 75 to 150, hoping to expose more
-- candidates to the reranker. SQL diagnostic showed the expected missing
-- candidates rank at positions 433-850 in keyword search — widening to 150
-- cannot reach them, and the wider pool just increases rerank token spend.
--
-- This migration reverts ONLY the pool widening:
--   1. result_limit DEFAULT: 150 → 75
--   2. Candidate semantic branch LIMIT: 150 → 50
--
-- Phase 2X.1.6 OR-based tsquery construction is PRESERVED exactly.
-- All other LIMITs (keyword 50, companies/contacts/notes 25) are unchanged.

DROP FUNCTION IF EXISTS public.hybrid_search(vector(1024), text, boolean, int, text);

CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding    vector(1024),
  query_text         text,
  include_notes      boolean DEFAULT false,
  result_limit       int     DEFAULT 75,
  filter_entity_type text    DEFAULT NULL
)
RETURNS TABLE (
  entity_type      text,
  entity_id        uuid,
  entity_name      text,
  snippet          text,
  result_type      text,        -- 'semantic' | 'keyword' | 'both'
  similarity_score float,       -- 1 - cosine_distance; 0..1, higher = more similar
  keyword_rank     float,       -- ts_rank result; 0 on semantic-only rows
  created_at       timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
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
        ts_rank(c.search_vector, tsq)::float,
        c.created_at
      FROM candidates c
      WHERE tsq IS NOT NULL
        AND c.search_vector @@ tsq
        AND (filter_entity_type IS NULL OR filter_entity_type = 'candidate')
      ORDER BY ts_rank(c.search_vector, tsq) DESC
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
$$;
