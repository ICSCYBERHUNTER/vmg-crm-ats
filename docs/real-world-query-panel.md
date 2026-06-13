# VMG Real-World Query Panel

**Purpose:** Validate smart search returns the right candidates for queries Mark would actually run on a normal Monday. Used as the primary post-Phase-2X.2 smoke test, and as the validation set for any future search-quality work.

**Created:** May 11, 2026
**Maintainer:** Mark
**Companion docs:** `vmg-smart-search-master-plan-v3.md`, `slim-vmg-smart-search-prd-v2.md`

---

## How to use this panel

1. Run each query on the production `/search` page with **smart search** mode (press Enter to trigger).
2. For Q1–Q4: check whether the expected candidates appear in the top 10. Note rerank position and match label.
3. For Q5: check coverage and entity-type mix rather than specific names (see Q5 grading rubric).
4. Capture results in a session log; compare against prior runs to catch regression.

---

## Q1 — Presales engineer / OT / Midwest

**Query (exact):** `Presales engineer who has experience in OT or Industrial cybersecurity and lives in the midwest`

**Expected top 3:**
- Eric Johansen
- Eric Visker
- Adam Boeckmann (less certain)

**Intent:** Sourcing for an OT presales role; need someone Midwest-based.

**Filter signals firing:**
- `sales_engineering` category boost (+0.05) via "presales"
- Location boost (+0.05) via "lives in the midwest" — Midwest expands to IL/IN/IA/MI/MN/MO/OH/WI
- **Total boost: +0.10**

**Pure semantic load:** "OT or Industrial cybersecurity" — does the embedding pull in OT-specific candidates regardless of exact title wording?

---

## Q2 — Sales leader / startup / cyber / US

**Query (exact):** `Sales leader, who has startup experience building and scaling early stage companies in cybersecurity and lives in the united states`

**Expected top 3:**
- Stephen Driggers
- Troy Roberts
- Obbe Knoop (less certain)

**Intent:** Sourcing a sales leader for an early-stage OT cyber startup; prior startup-scale experience required.

**Filter signals firing:** None.
- "Sales leader" doesn't trigger manages_people after Phase 2X.1 relaxation (the broad `\w+ leader(s)?` pattern was removed)
- "United States" isn't in the recognized place-name list (50 states + DC + named regions); location intent fires on "lives in" but no place name matches → no location signal
- "Cybersecurity" isn't a category trigger
- **Total boost: 0**

**Pure semantic load:** Whether the reranker honors "startup experience" and "building and scaling" as substantive work-history signals, and whether sales-leadership intent is read from "sales leader" without regex assist.

**Regression note:** Pre-Phase-2X.1, this query would have been gutted by the deleted `\w+ leader(s)?` regex. Good probe to confirm we're not nuking the pool anymore.

---

## Q3 — Customer success leader / building teams / cyber

**Query (exact):** `Customer success leader who has experience building teams in cybersecurity`

**Expected top 3:**
- Shri Chickerur
- Sean Guzman Murphy
- David Sunderland (less certain)

**Intent:** Sourcing a head-of-CS hire for a cyber vendor.

**Filter signals firing:** None.
- "Customer success" alone doesn't fire `customer_success` category — pattern requires "candidate(s)" or "hire(s)" suffix
- "Leader" alone was removed in Phase 2X.1
- "Building teams" isn't in the manages_people pattern list (only "manages a team," "leads a team," "team lead," "direct reports," "leadership experience," etc.)
- **Total boost: 0**

**Pure semantic load:** Whether the reranker treats "building teams" as a leadership signal and "customer success" as a category signal without explicit regex help. Probes the limit of semantic-only retrieval.

---

## Q4 — IC enterprise sales / startup / Southeast

**Query (exact):** `Individual contributor enterprise sales person who has worked at early stage or startup companies and lives in the Southeast united states`

**Expected top 3:**
- Ben Callaway
- David P. Smith
- Sandy H. Dlugozima

**Intent:** Sourcing an IC sales role at an early-stage OT cyber company; explicitly NOT a manager.

**Filter signals firing:**
- Location boost (+0.05) via "lives in the Southeast" — Southeast expands to AL/FL/GA/KY/MS/NC/SC/TN/WV
- **Total boost: +0.05**

**Most interesting test in the panel.** "Individual contributor" is an explicit anti-leadership signal that no regex captures — pure instruction/semantic territory. Phase 2X.2's universal instruction prefix is designed for exactly this: the reranker should down-weight VPs / directors / managers even if they otherwise match enterprise sales.

Also tests "startup experience" semantic recall (same as Q2).

---

## Q5 — Who do I know at Nozomi Networks?

**Query (exact):** `Who do I know at Nozomi Networks?`

**Expected results:** 100+ legitimate entities exist. Coverage query, not a precision query.

**Grading rubric** (different from Q1–Q4):
- Does the Nozomi company entity appear in the top 10? Should be near the top (name is weight A in companies search_vector).
- Do at least 2–3 known company_contacts at Nozomi appear?
- Do at least 1–2 candidates currently or formerly at Nozomi appear?
- Is the entity-type mix reasonable, or does the result collapse to all-candidates? (All-candidates result = sign that Phase 3 cross-entity work is still needed.)

**Intent:** Relationship audit — Mark wants to see who he can reach out to at Nozomi for referrals, intros, or deal context.

**Filter signals firing:** None. No filter pattern matches company names.

**Known structural gaps that affect this query** (from Recon B):
- `company_contacts.search_vector` doesn't include parent company name → keyword side can't match "Nozomi" against contact records; contacts only surface via semantic side (which DOES include company name in the embedding text)
- Note: this is the entity-type-coverage concern flagged for Phase 3 in v3 master plan

---

## Known limitations carrying across all queries

- **Match labels are post-boost.** A candidate at raw Voyage 0.78 + 0.15 boost shows as "Strong match" at 0.93. Filter alignment can inflate labels.
- **Outer sort uses `greatest(similarity_score, keyword_rank)`.** A fluky keyword-rank spike (query phrase verbatim in headline) can leapfrog stronger semantic matches.
- **Notes are weight D in keyword search** and always rank below entity titles for keyword-driven queries. The Include Notes toggle elevates them on the semantic side only.

---

## Session log template (copy this section for each run)

### Run [DATE TIME] — [optional: what changed since last run]

| Query | Expected in top 10? | Position(s) | Match labels | Notes |
|---|---|---|---|---|
| Q1 | | | | |
| Q2 | | | | |
| Q3 | | | | |
| Q4 | | | | |
| Q5 | (coverage check) | | | |