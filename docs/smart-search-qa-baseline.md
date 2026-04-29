# Smart Search QA Baseline

## Purpose

This document defines a repeatable manual QA baseline for Smart Search. Run this before merging any change that touches the search pipeline, hybrid_search SQL, embeddings, reranking, scope filtering, location filtering, or result routing.

The goal is to catch regressions early, not to validate every edge case.

---

## Architecture Reference

```
User query
  → Voyage embed (voyage-3-large)
  → Supabase hybrid_search() — semantic + keyword fusion
  → Hydrate records (fan-out fetch by entity type)
  → Scope filter (if entityScope != "all")
  → Candidate location hard filter (if query contains location intent)
  → Voyage rerank (rerank-2)
  → Return top 10 results
```

Fallback paths:
- **Embed fails** → falls back to `global_search()` keyword-only, no reranking
- **Rerank fails** → falls back to keyword_rank + similarity_score sort, no Voyage rerank

---

## How to Run a QA Pass

### Prerequisites

1. App is running locally or on staging — not production
2. At least one candidate, company, contact, job, and note exist in the DB with embeddings
3. Browser DevTools Network tab is open to monitor API calls
4. You are authenticated as a normal user (not impersonating)

### Steps

1. Open the app and navigate to `/search`
2. For each test case in the matrix below:
   a. Select the scope from the dropdown (or leave as "All")
   b. Toggle "Include Notes" as specified
   c. Type the query — **do not press Enter while typing**
   d. Submit the query (click Search or press Enter)
   e. Record the top 10 results
   f. Open the API response in DevTools → Network → `smart-search` → Response
   g. Inspect `_debug.counts` and `_debug.timings_ms`
3. Mark each test as Pass / Fail / Partial

---

## Pre-Checks (Run Before Every QA Pass)

| Check | Expected |
|-------|----------|
| Embedding job ran recently | Most records have `embedding_updated_at` not null |
| No Voyage API key errors in server logs | Embed path should not be hitting fallback |
| `hybrid_search` SQL function is current | Check Supabase → Functions → `hybrid_search` matches latest migration |
| Search page loads without console errors | No React errors on mount |
| Typing a query does NOT fire an API call | Network tab should be quiet while typing |

---

## Test Matrix

For each test, record the fields listed in the **Recording Template** section below.

---

### Scope: All

| # | Query | Include Notes | Expected top result | Notes |
|---|-------|---------------|---------------------|-------|
| A1 | `[candidate first + last name]` | off | That candidate | Basic name match |
| A2 | `[company name]` | off | That company | Basic company match |
| A3 | `[contact first + last name]` | off | That contact | Basic contact match |
| A4 | `[job title or company]` | off | Relevant job opening | Job match |
| A5 | `[unique phrase from a note]` | on | The entity the note belongs to | Notes surface when toggled on |
| A6 | `[unique phrase from a note]` | off | Should NOT return that note result | Notes hidden when toggle off |
| A7 | `xyzzy impossible query 999` | off | No results | Zero results handled gracefully |

---

### Scope: Candidates

| # | Query | Include Notes | Expected |
|---|-------|---------------|----------|
| C1 | `[candidate name]` | off | That candidate only — no companies/contacts/jobs in results |
| C2 | `OT cybersecurity sales` | off | Relevant candidates |
| C3 | `candidates in Illinois` | off | Candidates with Illinois or IL in location_state; non-candidate rows pass through |
| C4 | `[company name]` | off | Should return candidates who worked at that company (via work history), not the company itself |

---

### Scope: Companies

| # | Query | Include Notes | Expected |
|---|-------|---------------|----------|
| CO1 | `[company name]` | off | That company |
| CO2 | `[unique company description text]` | off | Relevant company |

---

### Scope: Contacts

| # | Query | Include Notes | Expected |
|---|-------|---------------|----------|
| CT1 | `[contact full name]` | off | That contact — result links to `/companies/[company_id]/contacts/[contact_id]` |
| CT2 | `Dragos` | off | Dragos-related contacts if any exist |

---

### Scope: Jobs

| # | Query | Include Notes | Expected |
|---|-------|---------------|----------|
| J1 | `[job title]` | off | That job opening |
| J2 | `open roles OT` | off | Open job openings relevant to OT |

---

### Scope: Notes (forces Include Notes on)

| # | Query | Include Notes | Expected |
|---|-------|---------------|----------|
| N1 | `[phrase unique to a note]` | forced on | Note result with correct parent routing |
| N2 | Note scope selected | — | Include Notes toggle should auto-enable and be locked |

---

## Regression Checks

Run these explicitly after any change touching the search pipeline.

---

### R1 — Candidate-only scope returns only candidates

1. Set scope to **Candidates**
2. Run any query that would normally match companies and contacts
3. **Pass:** zero company/contact/job results appear
4. **Fail:** any non-candidate result appears

---

### R2 — Contact routing (the "Dragos / Rob Lee 404 bug")

**Background:** Contact results require `contact_company_id` in the result payload to build the correct link `/companies/[company_id]/contacts/[contact_id]`. If `contact_company_id` is missing or null, clicking the result produces a 404.

1. Search for a known contact by name (e.g. "Rob Lee")
2. **Pass:** Clicking the result navigates to the correct company-contact detail page without a 404
3. **Fail:** 404, blank page, or result routes to `/contacts/[id]` (wrong path)
4. In the API response, confirm `results[i].contact_company_id` is a valid UUID for contact results

---

### R3 — Back-button cache behavior

1. Run a search and note the top results
2. Click a result to navigate to the detail page
3. Press the browser back button
4. **Pass:** The search results page restores the previous results instantly (Next.js router cache) without a new API call firing
5. **Fail:** A new `smart-search` API call fires on back-navigation

---

### R4 — No live search firing while typing

1. Open Network tab, filter to `smart-search`
2. Type a multi-word query slowly, one character at a time
3. **Pass:** Zero API calls fire during typing — call fires only on explicit submit (Enter or button click)
4. **Fail:** API calls fire with every keystroke or after a debounce delay

---

### R5 — Notes included only when expected

1. Toggle Include Notes **off**, search for a phrase unique to a note
2. **Pass:** No note results appear
3. Toggle Include Notes **on**, same query
4. **Pass:** Note results appear with correct entity label and parent routing
5. Set scope to **Notes** with Include Notes toggled off manually
6. **Pass:** Include Notes is automatically treated as on (forced by scope), note results appear

---

### R6 — Location hard filter (candidate scope)

1. Query: `candidates in Illinois` with scope **All** or **Candidates**
2. **Pass:** Only candidates with `location_state` = `Illinois`, `IL`, `il`, or similar variants appear in candidate results; non-candidate results are unaffected
3. **Fail:** Candidates from other states appear, or no candidates appear despite Illinois candidates existing with embeddings

---

### R7 — Region vs State filter distinction (Candidates page, not Smart Search)

This regression applies to the `/candidates` list page filters, not Smart Search.

1. Navigate to `/candidates`
2. Select **Region = Southeast** — confirm Georgia, Florida, Tennessee etc. candidates appear
3. Select **State = Georgia** — confirm only Georgia candidates appear, regardless of abbreviation vs full name in DB
4. **Pass:** Both filters work independently and produce correct results
5. **Fail:** Either dropdown returns zero results or wrong-state results

---

## Debug Payload Reference

When a search returns results, inspect `_debug` in the API response body:

```json
{
  "_debug": {
    "timings_ms": {
      "embed": 210,
      "hybrid_search": 85,
      "hydration": 30,
      "rerank": 320,
      "total": 650
    },
    "counts": {
      "hybrid_rows": 50,
      "after_hydration": 48,
      "after_scope_filter": 12,
      "after_location_filter": 8,
      "rerank_candidates": 8,
      "returned": 8
    },
    "fallbacks": {
      "embed_failed": false,
      "rerank_failed": false
    },
    "truncations": [],
    "raw_scores": [...]
  }
}
```

**What to look for:**

| Field | Red flag |
|-------|----------|
| `hybrid_rows` = 0 | No rows from DB at all — embedding or SQL issue |
| `after_hydration` << `hybrid_rows` | Many rows couldn't be hydrated — possible RLS issue or orphaned IDs |
| `after_scope_filter` = 0 | Scope filter dropped everything — check entityScope value sent |
| `after_location_filter` << `after_scope_filter` | Location filter is aggressive — check query phrasing and DB location_state values |
| `embed_failed` = true | Voyage API is down or key is invalid — results are keyword-only fallback |
| `rerank_failed` = true | Voyage rerank is down — results sorted by hybrid score only |
| `rerank` timing > 1000ms | Rerank is slow — may indicate too many candidates or API latency |

---

## Recording Template

Copy this block for each test case:

```
Query:
Scope:
Include Notes:
Expected top result:
Actual top 10 (entity_type | entity_name):
  1.
  2.
  3.
  ...
Bad/missing results:
API call fired (yes/no):
Cache hit (yes/no — Network status 200 vs from cache):
_debug.counts:
  hybrid_rows:
  after_hydration:
  after_scope_filter:
  after_location_filter:
  rerank_candidates:
  returned:
fallbacks: embed_failed= rerank_failed=
Pass/Fail/Partial:
Notes:
```
