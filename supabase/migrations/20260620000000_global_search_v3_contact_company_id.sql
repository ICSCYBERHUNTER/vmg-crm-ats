-- ============================================================================
-- global_search_v3: add contact_company_id to the output
-- ============================================================================
-- WHY:
--   The search UI routes a contact result to /companies/[companyId]/contacts/
--   [contactId], so it needs the contact's company id. Smart search already
--   returned this; keyword search (which calls global_search_v3 directly) did
--   not, so contact rows had no link and were dead on click. This adds the
--   company id to the function output for contact rows.
--
-- WHAT CHANGED (purely additive):
--   • RETURNS TABLE gains a trailing column: contact_company_id uuid.
--   • The final SELECT computes it: the contact's company_id for contact rows,
--     NULL for everything else. Matching, ranking, dedup, and search_vector
--     triggers are untouched — old-vs-new output was diffed across many queries
--     (loose words, phrases, empty input) and was identical on all prior columns.
--
-- NOTE ON DRIFT:
--   The live global_search_v3 (incl. the follow_ups branch) was applied to the
--   database directly and never committed as a migration — the repo only had up
--   to global_search_v2. This migration captures the full current definition so
--   the repo matches production again. Body below = live v3 verbatim + the new
--   column.
--
-- SIGNATURE CHANGE:
--   Adding an output column changes the return type, so CREATE OR REPLACE is not
--   allowed — the function is dropped and recreated. EXECUTE grants are dropped
--   with it and reapplied below (anon, authenticated, service_role; PUBLIC is
--   granted by default on CREATE).
--
-- ROLLBACK:
--   Re-create the previous definition (this file's body minus the
--   contact_company_id column in both RETURNS TABLE and the final SELECT) and
--   re-run the GRANT. The TS callers tolerate the column's absence.
-- ============================================================================

DROP FUNCTION IF EXISTS public.global_search_v3(text, text[]);

CREATE FUNCTION public.global_search_v3(
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
  created_at timestamp with time zone,
  contact_company_id uuid
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

  IF combined_tsq IS NULL THEN
    RETURN;
  END IF;

  name_boost_input := trim(coalesce(search_query, ''));
  IF phrases IS NOT NULL AND array_length(phrases, 1) > 0 THEN
    name_boost_input := trim(name_boost_input || ' ' || array_to_string(phrases, ' '));
  END IF;
  query_lower := lower(name_boost_input);
  query_words := regexp_split_to_array(query_lower, '\s+');

  RETURN QUERY

  WITH raw AS (

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
      3
    FROM notes n
    WHERE n.search_vector @@ combined_tsq
      AND (n.is_private = FALSE OR n.created_by = auth.uid())

    UNION ALL

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
      3
    FROM activities a
    WHERE a.search_vector @@ combined_tsq
      AND (a.is_private = FALSE OR a.created_by = auth.uid())

    UNION ALL

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

    SELECT
      'candidate'::TEXT,
      wh.candidate_id,
      (SELECT first_name || ' ' || last_name FROM candidates WHERE id = wh.candidate_id)::TEXT,
      'work_history'::TEXT,
      TS_HEADLINE('english', COALESCE(wh.job_title, '') || ' at ' || COALESCE(wh.company_name, '') || ' ' || COALESCE(wh.description, ''),
                  combined_tsq, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT,
      TS_RANK(wh.search_vector, combined_tsq),
      wh.created_at,
      2
    FROM work_history wh
    WHERE wh.search_vector @@ combined_tsq

    UNION ALL

    -- Follow-ups / Tasks (attributes to parent entity)
    SELECT
      f.entity_type::TEXT,
      f.entity_id,
      CASE
        WHEN f.entity_type = 'candidate' THEN (SELECT first_name || ' ' || last_name FROM candidates WHERE id = f.entity_id)
        WHEN f.entity_type = 'company' THEN (SELECT name FROM companies WHERE id = f.entity_id)
        WHEN f.entity_type = 'contact' THEN (SELECT first_name || ' ' || last_name FROM company_contacts WHERE id = f.entity_id)
        WHEN f.entity_type = 'job_opening' THEN (SELECT title FROM job_openings WHERE id = f.entity_id)
      END::TEXT,
      'task'::TEXT,
      TS_HEADLINE('english', COALESCE(f.title, '') || ' ' || COALESCE(f.description, ''), combined_tsq, 'MaxWords=35, MinWords=15, StartSel=**, StopSel=**')::TEXT,
      TS_RANK(f.search_vector, combined_tsq),
      f.created_at,
      3
    FROM follow_ups f
    WHERE f.search_vector @@ combined_tsq

  ),

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

  SELECT
    b.entity_type,
    b.entity_id,
    b.entity_name,
    b.result_type,
    b.snippet,
    (b.effective_rank + b.name_boost)::real AS rank,
    b.created_at,
    CASE
      WHEN b.entity_type = 'contact'
        THEN (SELECT company_id FROM company_contacts WHERE id = b.entity_id)
      ELSE NULL
    END::uuid AS contact_company_id
  FROM boosted b
  ORDER BY (b.effective_rank + b.name_boost) DESC
  LIMIT 50;

END;
$function$;

GRANT EXECUTE ON FUNCTION public.global_search_v3(text, text[]) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.global_search_v3(text, text[]) IS
  'Global keyword search (loose words + quoted phrases). Returns trailing contact_company_id (non-null only for contact rows) so the UI can route to /companies/[companyId]/contacts/[contactId]. Added 2026-06-20; output otherwise identical to prior v3 (verified by diff).';
