-- =============================================================================
-- Remove rejection_reason UNION branch from global_search()
--
-- The rejection_reason branch called TO_TSVECTOR() inline on every row in
-- candidate_applications (no stored search_vector column), which caused
-- statement timeouts while typing in the keyword search (All scope).
--
-- Rejection reasons are visible on the candidate detail / pipeline page.
-- global_search() does not need to find candidates via that text.
-- hybrid_search() (smart search) never included this branch.
--
-- All other branches (candidates, companies, contacts, notes, activities,
-- job_openings, work_history) are preserved exactly as in production.
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
BEGIN
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

  RETURN QUERY

  -- Search candidate records
  SELECT
    'candidate'::TEXT,
    c.id,
    (c.first_name || ' ' || c.last_name)::TEXT,
    'candidate_record'::TEXT,
    TS_HEADLINE('english',
                COALESCE(c.current_title, '') || ' at ' || COALESCE(c.current_company, '') ||
                ' ' || COALESCE(c.headline, '') ||
                ' ' || COALESCE(c.certifications, ''),
                tsquery_val, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT,
    TS_RANK(c.search_vector, tsquery_val),
    c.created_at
  FROM candidates c
  WHERE c.search_vector @@ tsquery_val

  UNION ALL

  -- Search company records
  SELECT
    'company'::TEXT,
    co.id,
    co.name::TEXT,
    'company_record'::TEXT,
    TS_HEADLINE('english', co.name || ' ' || COALESCE(co.industry, ''),
                tsquery_val, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT,
    TS_RANK(co.search_vector, tsquery_val),
    co.created_at
  FROM companies co
  WHERE co.search_vector @@ tsquery_val

  UNION ALL

  -- Search company contacts
  SELECT
    'contact'::TEXT,
    cc.id,
    (cc.first_name || ' ' || cc.last_name)::TEXT,
    'contact_record'::TEXT,
    TS_HEADLINE('english', COALESCE(cc.title, '') || ' at ' || (SELECT name FROM companies WHERE id = cc.company_id),
                tsquery_val, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT,
    TS_RANK(cc.search_vector, tsquery_val),
    cc.created_at
  FROM company_contacts cc
  WHERE cc.search_vector @@ tsquery_val

  UNION ALL

  -- Search notes, respecting privacy
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
    n.created_at
  FROM notes n
  WHERE n.search_vector @@ tsquery_val
    AND (n.is_private = FALSE OR n.created_by = auth.uid())

  UNION ALL

  -- Search activities, respecting privacy
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
    a.created_at
  FROM activities a
  WHERE a.search_vector @@ tsquery_val
    AND (a.is_private = FALSE OR a.created_by = auth.uid())

  UNION ALL

  -- Search job openings
  SELECT
    'job_opening'::TEXT,
    j.id,
    j.title::TEXT,
    'job_record'::TEXT,
    TS_HEADLINE('english', COALESCE(j.description, '') || ' ' || COALESCE(j.requirements, ''),
                tsquery_val, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT,
    TS_RANK(j.search_vector, tsquery_val),
    j.created_at
  FROM job_openings j
  WHERE j.search_vector @@ tsquery_val

  UNION ALL

  -- Search work history
  SELECT
    'candidate'::TEXT,
    wh.candidate_id,
    (SELECT first_name || ' ' || last_name FROM candidates WHERE id = wh.candidate_id)::TEXT,
    'work_history'::TEXT,
    TS_HEADLINE('english', COALESCE(wh.job_title, '') || ' at ' || COALESCE(wh.company_name, '') || ' ' || COALESCE(wh.description, ''),
                tsquery_val, 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**')::TEXT,
    TS_RANK(wh.search_vector, tsquery_val),
    wh.created_at
  FROM work_history wh
  WHERE wh.search_vector @@ tsquery_val

  ORDER BY 6 DESC
  LIMIT 50;
END;
$function$;
