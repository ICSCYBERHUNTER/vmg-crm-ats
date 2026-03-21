# Search Safety Rules

**Search is the #1 feature of this CRM. These rules exist to prevent breaking it.**

## Rule 1: New Text Fields Must Be Evaluated for Search

When adding a new TEXT column to `candidates`, `companies`, `company_contacts`, or `job_openings`:

1. Ask: "Would a recruiter ever search for this?"
2. If yes: update that table's `search_vector` trigger function to include the new field
3. If you update a trigger: review `global_search()` to ensure it handles the new field

**Example:** Adding a `skills` column to candidates → update `candidates_search_update()` trigger to include `COALESCE(NEW.skills, '')` in the search vector.

## Rule 2: Notes Must Stay Plain Text

The `notes.content` column is `TEXT` and must remain plain text. The `notes_search_update()` trigger indexes it with `TO_TSVECTOR('english', COALESCE(NEW.content, ''))`.

**If you change content to:**
- Rich text / HTML → search breaks (HTML tags get indexed as words)
- JSON → search breaks (JSON keys get indexed alongside values)
- Markdown → partially works but formatting characters pollute results

**The rule: do not change. Keep notes as plain text.**

## Rule 3: global_search() Does Not Auto-Discover

The `global_search()` PostgreSQL function uses explicit `UNION ALL` blocks for each searchable surface:
- candidates (search_vector)
- companies (search_vector)
- notes (search_vector)
- job_openings (search_vector)
- candidate_applications.rejection_reason (computed on the fly)

**If you create a new table with searchable text** (e.g., `candidate_skills`, `meeting_notes`), it will NOT appear in search results until you add a new `UNION ALL` block to `global_search()`.

## Rule 4: rejection_reason Has No Stored Vector

The `rejection_reason` field on `candidate_applications` is the only searchable field that does NOT use a stored `search_vector` column. It computes the search on the fly with `TO_TSVECTOR('english', ca.rejection_reason)`.

This is fine for hundreds of records but could slow down at thousands. If search performance degrades, the fix is:
1. Add a `search_vector` column to `candidate_applications`
2. Add a trigger to populate it from `rejection_reason`
3. Update the `global_search()` function to use the stored vector instead of computing on the fly

## Rule 5: Test After Every Schema Change

After ANY change to database schema, triggers, or the global_search function:

1. Insert a test record with unique text (e.g., "TESTMARKER_abc123")
2. Run: `SELECT * FROM global_search('TESTMARKER_abc123');`
3. Verify the record appears in results
4. Delete the test record

This takes 30 seconds. Do it every time.

## Rule 6: Search Vector Weights Matter

Search vectors use weights to rank results:
- **A** (highest): names, primary identifiers
- **B** (medium): titles, descriptions, categories
- **C** (lower): locations, secondary info

When adding a field to a search_vector trigger, choose the appropriate weight. A recruiter's name search should rank higher than a location match.

## Debugging Search Issues

If a search returns empty results when it shouldn't:

1. **Check the trigger exists:** `SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'your_table';`
2. **Check the search_vector is populated:** `SELECT search_vector FROM your_table WHERE id = 'record_id';` — if NULL, the trigger isn't firing
3. **Check the GIN index exists:** `SELECT indexname FROM pg_indexes WHERE tablename = 'your_table' AND indexdef LIKE '%gin%';`
4. **Check global_search() includes the table:** Read the function source and verify there's a UNION ALL block for the table
5. **Check the query:** `SELECT * FROM global_search('your search term');` — the function uses `PLAINTO_TSQUERY` which automatically ANDs all terms
