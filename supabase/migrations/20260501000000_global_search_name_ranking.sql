-- =============================================================================
-- Improve global_search() ranking for candidate/contact name queries.
--
-- Problem:
--   Searching "rich" returned candidates with "Richmond" in work history or
--   skills above the candidate actually named "Rich Hlavati". Work history,
--   notes, and activity rows all competed on equal footing with the primary
--   candidate record, and there was no deduplication — the same candidate
--   could appear multiple times from different branches.
--
-- Fix (three changes):
--   1. Wrap the UNION ALL branches in a CTE and deduplicate by
--      (entity_type, entity_id) before final ordering. Prefer primary-record
--      rows (candidate_record, company_record, etc.) over secondary rows
--      (work_history, notes, activities) for snippet and result_type.
--   2. Add a name_boost column that rewards direct name matches. The boost
--      is computed by comparing the lowercased search query against the
--      lowercased entity_name using prefix/exact matching — no tsvector
--      involved, so it works for partial names and ignores stemming.
--   3. Final ORDER BY uses (rank + name_boost) so that a candidate whose
--      name matches the query sorts above incidental body-text matches.
--
-- Return signature is unchanged — callers receive the same 7 columns.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.global_search(search_query text)
RETURNS TABLE(
  entity_type text,
  entity_id uuid,
  entity_name text,
  result_type text,
  snippet text,
  rank real,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  tsquery_val TSQUERY;
  query_lower TEXT;       -- lowercased full query for name matching
  query_words TEXT[];     -- individual lowercased words from the query
BEGIN
  -- Build prefix tsquery: "rich h" → 'rich:* & h:*'
  tsquery_val := to_tsquery('english',
    array_to_string(
      ARRAY(
        SELECT word || ':*'
        FROM unnest(regexp_split_to_array(trim(search_query), '\s+')) AS word
        WHERE word <> ''
      ),
      ' & '
    )
  );

  -- Prepare lowercased query for name-boost logic below.
  query_lower := lower(trim(search_query));
  query_words := regexp_split_to_array(query_lower, '\s+');

  RETURN QUERY

  WITH raw AS (

    -- ── Candidates ───────────────────────────────────────────────────────────
    SELECT
      'candidate'::TEXT                                                AS entity_type,
      c.id                                                             AS entity_id,
      (c.first_name || ' ' || c.last_name)::TEXT                      AS entity_name,
      'candidate_record'::TEXT                                         AS result_type,
      TS_HEADLINE('english',
                  COALESCE(c.current_title, '') || ' at ' || COALESCE(c.current_company, '') ||
                  ' ' || COALESCE(c.headline, '') ||
                  ' ' || COALESCE(c.certifications, ''),
                  tsquery_val, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT AS snippet,
      TS_RANK(c.search_vector, tsquery_val)                            AS rank,
      c.created_at,
      1                                                                AS source_priority
    FROM candidates c
    WHERE c.search_vector @@ tsquery_val

    UNION ALL

    -- ── Companies ────────────────────────────────────────────────────────────
    SELECT
      'company'::TEXT,
      co.id,
      co.name::TEXT,
      'company_record'::TEXT,
      TS_HEADLINE('english', co.name || ' ' || COALESCE(co.industry, ''),
                  tsquery_val, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT,
      TS_RANK(co.search_vector, tsquery_val),
      co.created_at,
      1
    FROM companies co
    WHERE co.search_vector @@ tsquery_val

    UNION ALL

    -- ── Company Contacts ─────────────────────────────────────────────────────
    SELECT
      'contact'::TEXT,
      cc.id,
      (cc.first_name || ' ' || cc.last_name)::TEXT,
      'contact_record'::TEXT,
      TS_HEADLINE('english', COALESCE(cc.title, '') || ' at ' || (SELECT name FROM companies WHERE id = cc.company_id),
                  tsquery_val, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT,
      TS_RANK(cc.search_vector, tsquery_val),
      cc.created_at,
      1
    FROM company_contacts cc
    WHERE cc.search_vector @@ tsquery_val

    UNION ALL

    -- ── Notes (privacy-filtered) ─────────────────────────────────────────────
    SELECT
      n.entity_type::TEXT,
      n.entity_id,
      CASE
        WHEN n.entity_type = 'candidate' THEN
          (SELECT first_name || ' ' || last_name FROM candidates WHERE id = n.entity_id)
        WHEN n.entity_type = 'company' THEN
          (SELECT name FROM companies WHERE id = n.entity_id)
        WHEN n.entity_type = 'contact' THEN
          (SELECT first_name || ' ' || last_name FROM company_contacts WHERE id = n.entity_id)
        WHEN n.entity_type = 'job_opening' THEN
          (SELECT title FROM job_openings WHERE id = n.entity_id)
      END::TEXT,
      ('note_' || n.note_type)::TEXT,
      TS_HEADLINE('english', n.content, tsquery_val,
                  'MaxWords=35, MinWords=15, StartSel=**, StopSel=**')::TEXT,
      TS_RANK(n.search_vector, tsquery_val),
      n.created_at,
      3                  -- secondary source: notes deprioritized vs primary record
    FROM notes n
    WHERE n.search_vector @@ tsquery_val
      AND (n.is_private = FALSE OR n.created_by = auth.uid())

    UNION ALL

    -- ── Activities (privacy-filtered) ────────────────────────────────────────
    SELECT
      a.entity_type::TEXT,
      a.entity_id,
      CASE
        WHEN a.entity_type = 'candidate' THEN
          (SELECT first_name || ' ' || last_name FROM candidates WHERE id = a.entity_id)
        WHEN a.entity_type = 'company' THEN
          (SELECT name FROM companies WHERE id = a.entity_id)
        WHEN a.entity_type = 'company_contact' THEN
          (SELECT first_name || ' ' || last_name FROM company_contacts WHERE id = a.entity_id)
        WHEN a.entity_type = 'job_opening' THEN
          (SELECT title FROM job_openings WHERE id = a.entity_id)
      END::TEXT,
      ('activity_' || a.activity_type)::TEXT,
      TS_HEADLINE('english', COALESCE(a.description, ''), tsquery_val,
                  'MaxWords=35, MinWords=15, StartSel=**, StopSel=**')::TEXT,
      TS_RANK(a.search_vector, tsquery_val),
      a.created_at,
      3                  -- secondary source
    FROM activities a
    WHERE a.search_vector @@ tsquery_val
      AND (a.is_private = FALSE OR a.created_by = auth.uid())

    UNION ALL

    -- ── Job Openings ─────────────────────────────────────────────────────────
    SELECT
      'job_opening'::TEXT,
      j.id,
      j.title::TEXT,
      'job_record'::TEXT,
      TS_HEADLINE('english', COALESCE(j.description, '') || ' ' || COALESCE(j.requirements, ''),
                  tsquery_val, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT,
      TS_RANK(j.search_vector, tsquery_val),
      j.created_at,
      1
    FROM job_openings j
    WHERE j.search_vector @@ tsquery_val

    UNION ALL

    -- ── Work History ─────────────────────────────────────────────────────────
    SELECT
      'candidate'::TEXT,
      wh.candidate_id,
      (SELECT first_name || ' ' || last_name FROM candidates WHERE id = wh.candidate_id)::TEXT,
      'work_history'::TEXT,
      TS_HEADLINE('english', COALESCE(wh.job_title, '') || ' at ' || COALESCE(wh.company_name, '') || ' ' || COALESCE(wh.description, ''),
                  tsquery_val, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT,
      TS_RANK(wh.search_vector, tsquery_val),
      wh.created_at,
      2                  -- secondary: below primary candidate record
    FROM work_history wh
    WHERE wh.search_vector @@ tsquery_val

  ),

  -- ════════════════════════════════════════════════════════════════════════════
  -- DEDUPLICATION
  -- The same (entity_type, entity_id) can appear from multiple branches
  -- (e.g. a candidate record + their work history + notes about them).
  -- Collapse to one row per entity, preferring the primary-record branch
  -- (source_priority = 1) for snippet and result_type. Take the MAX rank
  -- across all branches so that any high-scoring match lifts the entity.
  -- ════════════════════════════════════════════════════════════════════════════
  deduped AS (
    SELECT DISTINCT ON (r.entity_type, r.entity_id)
      r.entity_type,
      r.entity_id,
      r.entity_name,
      r.result_type,
      r.snippet,
      r.rank,
      r.created_at,
      r.source_priority
    FROM (
      -- Within each entity, pick the row with the best source_priority,
      -- breaking ties by rank. We need the max rank across ALL branches
      -- for final sorting, but we want snippet/result_type from the
      -- primary record. So we pick the best snippet row here, and
      -- compute max_rank separately in the next CTE.
      SELECT
        raw.*,
        ROW_NUMBER() OVER (
          PARTITION BY raw.entity_type, raw.entity_id
          ORDER BY raw.source_priority ASC, raw.rank DESC
        ) AS rn
      FROM raw
    ) r
    WHERE r.rn = 1
  ),

  -- Compute the max rank per entity across ALL branches (not just the
  -- primary-record row). This ensures a work-history match still lifts
  -- a candidate even if the candidate-record branch scored lower.
  max_ranks AS (
    SELECT
      r.entity_type,
      r.entity_id,
      MAX(r.rank) AS max_rank
    FROM raw r
    GROUP BY r.entity_type, r.entity_id
  ),

  -- ════════════════════════════════════════════════════════════════════════════
  -- NAME BOOST
  -- Compares the lowercased search query against entity_name using simple
  -- string prefix matching (not tsvector). This is intentionally naive —
  -- no stemming, no lexeme comparison — because when a recruiter types
  -- "rich h" they mean "someone whose name starts with Rich H", not
  -- "documents containing the stem 'rich'".
  --
  -- Boost tiers (additive to ts_rank, which is typically 0.0–0.4):
  --   0.9  — exact full-name match           ("rich hlavati" = "Rich Hlavati")
  --   0.7  — full query is a leading prefix   ("rich h" matches "Rich Hlavati")
  --   0.5  — first word matches first_name prefix AND second word matches
  --          something in the name            ("phil s" matches "Philip Smith")
  --   0.3  — first query word is a prefix of first or last name
  --          ("rich" matches "Rich Hlavati")
  --   0.0  — no name match
  -- ════════════════════════════════════════════════════════════════════════════
  boosted AS (
    SELECT
      d.entity_type,
      d.entity_id,
      d.entity_name,
      d.result_type,
      d.snippet,
      GREATEST(d.rank, mr.max_rank) AS effective_rank,
      d.created_at,
      CASE
        -- Exact full-name match (case-insensitive)
        WHEN lower(d.entity_name) = query_lower
          THEN 0.9

        -- Full query is a leading prefix of entity_name
        -- e.g. "rich h" matches "Rich Hlavati"
        WHEN lower(d.entity_name) LIKE (query_lower || '%')
          THEN 0.7

        -- Multi-word query: first word prefixes first name-word, and
        -- second word prefixes any subsequent name-word.
        -- e.g. "phil s" matches "Philip Smith" or "Philip Sanchez"
        WHEN array_length(query_words, 1) >= 2
          AND EXISTS (
            SELECT 1
            FROM unnest(regexp_split_to_array(lower(d.entity_name), '\s+'))
                   WITH ORDINALITY AS name_word(w, pos)
            WHERE pos = 1
              AND name_word.w LIKE (query_words[1] || '%')
          )
          AND EXISTS (
            SELECT 1
            FROM unnest(regexp_split_to_array(lower(d.entity_name), '\s+'))
                   WITH ORDINALITY AS name_word(w, pos)
            WHERE pos > 1
              AND name_word.w LIKE (query_words[2] || '%')
          )
          THEN 0.5

        -- Single-word query prefixes the first or last name
        -- e.g. "rich" matches "Rich Hlavati", "philip" matches "Philip ..."
        WHEN EXISTS (
          SELECT 1
          FROM unnest(regexp_split_to_array(lower(d.entity_name), '\s+')) AS name_word
          WHERE name_word LIKE (query_words[1] || '%')
        )
          THEN 0.3

        ELSE 0.0
      END::real AS name_boost
    FROM deduped d
    JOIN max_ranks mr ON mr.entity_type = d.entity_type AND mr.entity_id = d.entity_id
  )

  -- ── Final output ──────────────────────────────────────────────────────────
  -- Sort by (effective_rank + name_boost) descending.
  -- The name_boost ensures that a direct name match outranks body-text
  -- matches even when ts_rank gives those a higher raw score.
  SELECT
    b.entity_type,
    b.entity_id,
    b.entity_name,
    b.result_type,
    b.snippet,
    (b.effective_rank + b.name_boost)::real AS rank,
    b.created_at
  FROM boosted b
  ORDER BY (b.effective_rank + b.name_boost) DESC
  LIMIT 50;

END;
$function$;
