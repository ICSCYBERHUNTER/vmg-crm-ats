-- ============================================================================
-- global_search_v2: phrase-matching support for the global keyword search
-- ============================================================================
-- Adds a parallel function alongside the existing global_search().
--
-- What's new in v2:
--   • New parameter `phrases text[] DEFAULT '{}'` — an array of exact phrases
--     (e.g. ["sales engineer", "customer identification program"]). Each phrase
--     becomes a phraseto_tsquery('english', …) which requires the words to
--     appear adjacent and in order.
--   • Loose unquoted words keep their existing behavior: prefix tsquery
--     (word:*) AND'd together.
--   • Loose-words tsquery is AND'd with each phrase tsquery to form one final
--     tsquery used in every UNION ALL branch.
--   • The name-boost CTE uses (search_query + ' ' + all phrases joined) so a
--     quoted name like `"rich hlavati"` still triggers the prefix name boost.
--   • Empty input (no loose words AND no phrases) returns zero rows.
--
-- Why parallel-not-replace:
--   • Zero-risk rollback — if anything misbehaves, callers can be pointed back
--     at global_search() in one line.
--   • Old function is preserved verbatim; this migration only CREATES.
--   • A follow-up migration (planned ~1-2 weeks after deploy) will drop the
--     old global_search() once v2 is validated.
--
-- Callers updated in a separate TS commit:
--   • src/lib/supabase/search.ts (browser RPC wrapper)
--   • src/app/api/smart-search/route.ts (embed-failure fallback)
--
-- Backward-compatible signature: phrases defaults to '{}', so a caller that
-- only passes search_query gets behavior identical to global_search(), modulo
-- one edge case noted below.
--
-- Edge case worth knowing: with phrases='{}', the body branches and dedup
-- logic are line-for-line identical to global_search(). The only logic
-- difference vs. the original is the explicit empty-input early return.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.global_search_v2(
  search_query text,
  phrases text[] DEFAULT '{}'
)
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
  loose_words_tsq tsquery;
  combined_tsq    tsquery;
  phrase_text     text;
  query_lower     text;
  query_words     text[];
  name_boost_input text;
BEGIN
  -- ── Build loose-words prefix tsquery ───────────────────────────────────
  -- Same logic as legacy global_search(): split on whitespace, append :*,
  -- join with &. Skipped entirely if search_query is empty/blank.
  IF trim(coalesce(search_query, '')) <> '' THEN
    loose_words_tsq := to_tsquery('english',
      array_to_string(
        ARRAY(
          SELECT word || ':*'
          FROM unnest(regexp_split_to_array(trim(search_query), '\s+')) AS word
          WHERE word <> ''
        ),
        ' & '
      )
    );
  END IF;

  -- ── Combine loose words AND each phrase ────────────────────────────────
  -- phraseto_tsquery produces lexemes joined by <-> (followed-by) operator,
  -- which is what gives us strict adjacent-and-in-order matching.
  combined_tsq := loose_words_tsq;
  IF phrases IS NOT NULL AND array_length(phrases, 1) > 0 THEN
    FOREACH phrase_text IN ARRAY phrases LOOP
      IF trim(coalesce(phrase_text, '')) <> '' THEN
        IF combined_tsq IS NULL THEN
          combined_tsq := phraseto_tsquery('english', phrase_text);
        ELSE
          combined_tsq := combined_tsq && phraseto_tsquery('english', phrase_text);
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ── Empty input guard ──────────────────────────────────────────────────
  -- No loose words AND no phrases (or all phrases were blank) → nothing to
  -- search for. Return zero rows rather than scanning every table.
  IF combined_tsq IS NULL THEN
    RETURN;
  END IF;

  -- ── Name-boost input ───────────────────────────────────────────────────
  -- Combine loose words + all phrases as plain text so the name-boost CTE
  -- can still do simple string-prefix matching against entity_name. Without
  -- this, a user searching `"rich hlavati"` would lose the name shortcut.
  name_boost_input := trim(coalesce(search_query, ''));
  IF phrases IS NOT NULL AND array_length(phrases, 1) > 0 THEN
    name_boost_input := trim(name_boost_input || ' ' || array_to_string(phrases, ' '));
  END IF;
  query_lower := lower(name_boost_input);
  query_words := regexp_split_to_array(query_lower, '\s+');

  -- ── Main query (UNION ALL across all searchable surfaces) ──────────────
  -- This is line-for-line equivalent to legacy global_search(), with
  -- `tsquery_val` replaced by `combined_tsq` throughout.

  RETURN QUERY

  WITH raw AS (

    -- ── Candidates ───────────────────────────────────────────────────────
    SELECT
      'candidate'::TEXT                                                AS entity_type,
      c.id                                                             AS entity_id,
      (c.first_name || ' ' || c.last_name)::TEXT                       AS entity_name,
      'candidate_record'::TEXT                                         AS result_type,
      TS_HEADLINE('english',
                  COALESCE(c.current_title, '') || ' at ' || COALESCE(c.current_company, '') ||
                  ' ' || COALESCE(c.headline, '') ||
                  ' ' || COALESCE(c.certifications, ''),
                  combined_tsq, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT AS snippet,
      TS_RANK(c.search_vector, combined_tsq)                           AS rank,
      c.created_at,
      1                                                                AS source_priority
    FROM candidates c
    WHERE c.search_vector @@ combined_tsq

    UNION ALL

    -- ── Companies ────────────────────────────────────────────────────────
    SELECT
      'company'::TEXT,
      co.id,
      co.name::TEXT,
      'company_record'::TEXT,
      TS_HEADLINE('english', co.name || ' ' || COALESCE(co.industry, ''),
                  combined_tsq, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT,
      TS_RANK(co.search_vector, combined_tsq),
      co.created_at,
      1
    FROM companies co
    WHERE co.search_vector @@ combined_tsq

    UNION ALL

    -- ── Company Contacts ─────────────────────────────────────────────────
    SELECT
      'contact'::TEXT,
      cc.id,
      (cc.first_name || ' ' || cc.last_name)::TEXT,
      'contact_record'::TEXT,
      TS_HEADLINE('english', COALESCE(cc.title, '') || ' at ' || (SELECT name FROM companies WHERE id = cc.company_id),
                  combined_tsq, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT,
      TS_RANK(cc.search_vector, combined_tsq),
      cc.created_at,
      1
    FROM company_contacts cc
    WHERE cc.search_vector @@ combined_tsq

    UNION ALL

    -- ── Notes (privacy-filtered) ─────────────────────────────────────────
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
      TS_HEADLINE('english', n.content, combined_tsq,
                  'MaxWords=35, MinWords=15, StartSel=**, StopSel=**')::TEXT,
      TS_RANK(n.search_vector, combined_tsq),
      n.created_at,
      3                  -- secondary source: notes deprioritized vs primary record
    FROM notes n
    WHERE n.search_vector @@ combined_tsq
      AND (n.is_private = FALSE OR n.created_by = auth.uid())

    UNION ALL

    -- ── Activities (privacy-filtered) ────────────────────────────────────
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
      TS_HEADLINE('english', COALESCE(a.description, ''), combined_tsq,
                  'MaxWords=35, MinWords=15, StartSel=**, StopSel=**')::TEXT,
      TS_RANK(a.search_vector, combined_tsq),
      a.created_at,
      3                  -- secondary source
    FROM activities a
    WHERE a.search_vector @@ combined_tsq
      AND (a.is_private = FALSE OR a.created_by = auth.uid())

    UNION ALL

    -- ── Job Openings ─────────────────────────────────────────────────────
    SELECT
      'job_opening'::TEXT,
      j.id,
      j.title::TEXT,
      'job_record'::TEXT,
      TS_HEADLINE('english', COALESCE(j.description, '') || ' ' || COALESCE(j.requirements, ''),
                  combined_tsq, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT,
      TS_RANK(j.search_vector, combined_tsq),
      j.created_at,
      1
    FROM job_openings j
    WHERE j.search_vector @@ combined_tsq

    UNION ALL

    -- ── Work History ─────────────────────────────────────────────────────
    SELECT
      'candidate'::TEXT,
      wh.candidate_id,
      (SELECT first_name || ' ' || last_name FROM candidates WHERE id = wh.candidate_id)::TEXT,
      'work_history'::TEXT,
      TS_HEADLINE('english', COALESCE(wh.job_title, '') || ' at ' || COALESCE(wh.company_name, '') || ' ' || COALESCE(wh.description, ''),
                  combined_tsq, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT,
      TS_RANK(wh.search_vector, combined_tsq),
      wh.created_at,
      2                  -- secondary: below primary candidate record
    FROM work_history wh
    WHERE wh.search_vector @@ combined_tsq

  ),

  -- ══════════════════════════════════════════════════════════════════════
  -- DEDUPLICATION — line-for-line identical to legacy global_search().
  -- One row per (entity_type, entity_id); snippet from highest source_priority
  -- branch, rank from MAX across all branches.
  -- ══════════════════════════════════════════════════════════════════════
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

  max_ranks AS (
    SELECT
      r.entity_type,
      r.entity_id,
      MAX(r.rank) AS max_rank
    FROM raw r
    GROUP BY r.entity_type, r.entity_id
  ),

  -- ══════════════════════════════════════════════════════════════════════
  -- NAME BOOST — line-for-line identical to legacy global_search().
  -- query_lower / query_words now include both loose words AND quoted phrase
  -- contents, so a user searching `"rich hlavati"` still gets the +0.9
  -- exact-name-match boost rather than just FTS phrase matching.
  -- ══════════════════════════════════════════════════════════════════════
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
        WHEN lower(d.entity_name) = query_lower
          THEN 0.9
        WHEN lower(d.entity_name) LIKE (query_lower || '%')
          THEN 0.7
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

  -- ── Final output ────────────────────────────────────────────────────────
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

COMMENT ON FUNCTION public.global_search_v2(text, text[]) IS
  'v2 of global_search adding quoted-phrase support via the phrases[] parameter. Parallel to legacy global_search() for rollback safety. Old function will be dropped in a follow-up migration after 1-2 weeks of v2 in production.';
