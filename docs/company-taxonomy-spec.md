# VMG Company Classification Taxonomy — v1 (Build Spec)

**Status:** Decisions locked, ready to build · 2026-06-27
**Purpose:** Structured, *filterable* company classification for **business development and market mapping**.
**Non-goals:** candidate-to-job matching · academic completeness · full-text / smart search. This is **filter-only** and never touches `global_search` or the search vectors.
**Storage:** everything lives on the existing `companies` table. Single-select → `text` column. Multi-select → `text[]` array. **No tags table in v1.**

---

## The model in one line

Five independent fields, each answering a different question:

| Field | Question it answers | Type | Applies to |
|---|---|---|---|
| `company_type` | What kind of company is this / how do I engage it? | single-select | all |
| `primary_segment` | What's the **main** thing it does? | single-select | vendors & providers |
| `secondary_segments` | What **else** does it do? | multi-select | all |
| `industry_verticals` | What industries does it operate in / serve? | multi-select | all |
| `is_ai_native` | Is it an AI-native security company? | boolean | all |

**Decision shortcut when tagging a company:**
- A *business model* → `company_type`
- *The* thing they do → `primary_segment`
- *An additional* thing they do → `secondary_segments`
- An *industry* → `industry_verticals`
- A trait *every* vendor could claim ("AI-native," "critical infrastructure") → a **flag or tag**, never a primary category.

---

## Field 1 — `company_type` (single-select)

| Value | What it is |
|---|---|
| `cybersecurity_vendor` | Builds and sells security **products** (software/hardware/platforms). |
| `technology_vendor` | Non-security tech that's still a BD target/partner/buyer (automation OEMs, cloud, networking, industrial software). |
| `managed_security_provider` | Delivers security **as an ongoing managed service** (MSSP / MDR). |
| `var_reseller` | Resells third-party products; light services attached. |
| `systems_integrator` | Designs, deploys, integrates systems — incl. OT/control-system & automation SIs. |
| `consulting_advisory` | Project-based services: strategy, assessments, IR, pen testing, GRC, OT consulting. |
| `asset_owner_end_user` | Operates infrastructure and **buys** security. The demand side. |
| `government_public_sector` | Government / public entities (different BD motion: procurement, clearances). |
| `investor` | PE / VC. Useful for portfolio intel & referral sourcing. |
| `research_institution_lab` | National labs, FFRDCs, academic centers (INL, MITRE, Sandia). Big in OT/ICS. |
| `other_needs_review` | Escape hatch. |

**Multi-hat rule:** for firms that wear several hats (Optiv = VAR + MSSP + consulting), set `company_type` to the **primary lens you engage them through**, and carry the other hats as `secondary_segments` tags.

---

## Field 2 — `primary_segment` (single-select)

The main capability of a vendor or provider. Leave blank for pure asset owners / government / investors. Use `general_multi_domain` for diversified platforms and generalist MSSPs that have no single "main thing."

**Core niche (highest precision):**
- `ot_ics_cps_security` — securing the OT/ICS/IIoT/IoMT/CPS environment the customer *operates* (Dragos, Claroty, Nozomi, Armis, Forescout, TXOne).
- `connected_product_security` — helping device **manufacturers** secure what they *ship*: firmware, embedded, secure-by-design (MedCrypt, Sternum, NetRise, Finite State, Cybellum). *Different buyer than above.*

**AI security (added 2026-06-27 — a real cluster in your book):**
- `ai_security` — securing AI *itself*: AI agents, LLMs, agent-to-agent comms, AI usage governance / AI-SPM (Geordie AI, Helmet, Onyx, WitnessAI, Gray Swan). **NOT the same as `is_ai_native`** — that flag means "built *on* AI"; this segment means "secures AI." A company can be both (WitnessAI) or either alone.

**Standard cyber primaries:**
`network_security` · `sase_sse` · `endpoint_security` · `identity_access_management` · `cloud_security` · `data_security` · `application_security` · `security_operations` · `threat_intelligence` · `vulnerability_exposure_mgmt` · `offensive_security_validation` · `email_security` · `grc_risk_compliance` · `third_party_risk_mgmt` · `security_awareness_training`

**Generalist:**
- `general_multi_domain` — Palo Alto, Microsoft, Arctic Wolf, big VARs, etc.

> Note: `cloud_security` **is** CNAPP. `vulnerability_exposure_mgmt` **is** exposure management / CTEM. Don't make those separate.
> `security_awareness_training` reinstated (you have a real one — Adaptive Security). Only `fraud_abuse_bot_protection` stays dropped.

---

## Field 3 — `secondary_segments` (multi-select `text[]`)

The flexible "everything else true about this company" field — capability badges, service badges, and niche-domain flavors. **Grow this organically. Do NOT pre-create the full list below — seed ~10–15 you'll actually filter on and add as you go.**

**Suggested seed set:**
`pure_ot_ics` · `broad_cps_xiot` · `iot_security` · `medical_device_iomt` · `firmware_security` · `ot_secure_remote_access` · `mssp` · `mdr` · `incident_response` · `penetration_testing` · `ot_ics_consulting` · `deployment_integration`

**Full reference vocabulary (add as needed):**
- *Capability badges:* `ndr` `pam` `dlp` `dspm` `sspm` `cspm` `casb` `ztna` `siem` `soar` `api_security` `asm` `bas` `itdr` `deception` `cyber_range` `machine_identity_pki` `ddos_protection` `backup_cyber_resilience`
- *Niche-domain flavors:* `pure_ot_ics` `broad_cps_xiot` `iot_security` `medical_device_iomt` `automotive_security` `building_automation` `ot_secure_remote_access` `firmware_security` `embedded_security` `sbom_supply_chain` `critical_infrastructure`
- *Service badges (multi-hat firms):* `mssp` `mdr` `incident_response` `penetration_testing` `red_team` `forensics` `threat_hunting` `grc_consulting` `vciso` `ot_ics_consulting` `deployment_integration` `reselling` `security_training`

**Promote a tag → `primary_segment` only if you accumulate a real cluster** of them (candidates: `api_security`, `medical_device_iomt`, `automotive_security`, `pam`). Not the case today.

---

## Field 4 — `industry_verticals` (multi-select `text[]`)

The industries a company operates in (asset owners) or sells into (vendors). Applies to **everyone** — this is what lets you ask "show me every company that plays in oil & gas."

`energy` · `electric_utility` · `oil_gas` · `water_wastewater` · `utilities` · `manufacturing` · `critical_manufacturing` · `chemical` · `pharmaceuticals` · `healthcare_delivery` · `transportation` · `rail` · `maritime` · `aviation` · `automotive` · `aerospace_space` · `defense` · `data_centers` · `smart_buildings` · `mining_metals` · `food_agriculture` · `financial_services` · `communications` · `government` · `industrial_automation`

> This field replaces the old free-text `industry` and the (now-dropped) `critical_infrastructure_sector`. Grow it organically like `secondary_segments`.

---

## Field 5 — `is_ai_native` (boolean)

Yes/no flag for AI-native security companies. It's an **attribute** (cross-cuts every segment), not a category — Darktrace is still `network_security`, Abnormal is still `email_security`. This powers your "AI-native target list on demand": filter `is_ai_native = true`.

---

## Classification rules (the day-to-day judgment calls)

- **Multi-hat firms** → classify by your primary engagement lens; other hats become `secondary_segments`. (Accenture → `consulting_advisory` or `systems_integrator`, primary_segment `ot_ics_cps_security`, plus tags.)
- **Parent / subsidiary** (e.g. Accenture → Dragos → Phosphorus) → each company stays its **own record with its own segment**. Ownership is a note, not a field. (A `parent_company` link is a someday-maybe, not v1.)
- **`other_needs_review`** is for anything that genuinely won't sit still — don't bend the whole taxonomy around 2–3 outliers.

---

## Dropped / deferred (so we remember the "why")

- **`critical_infrastructure_sector` — DROPPED.** `industry_verticals` covers BD filtering; the clean CISA list was for compliance framing, which isn't our use case. One column to add back if ever needed.
- **Tier-3 generic primary — DROPPED:** `fraud_abuse_bot_protection` (not our niche). `security_awareness_training` was **reinstated** — you have a real one (Adaptive Security).
- **`ai_security` primary — ADDED 2026-06-27.** Data review surfaced a ~5-company cluster (Geordie, Helmet, Onyx, WitnessAI, Gray Swan) of "secure-the-AI" vendors with no home.
- **Ownership / funding-status field — DEFERRED.** Changes often, easily Googled, one column to add later if missed.
- **Promoting niche tags to primaries — NOT NOW** (no cluster yet).

---

## Current data → backfill map (your 29 companies)

Existing `company_type` values are legacy and get remapped: `vendor` → `cybersecurity_vendor` (re-check any that are really `technology_vendor`), `asset_owner` → `asset_owner_end_user`, `consulting` → `consulting_advisory`.

| Current `industry` value | Count | New classification |
|---|---|---|
| `Native A.I. Cybersecurity` | 17 | `is_ai_native = true` + assign each a **real** `primary_segment` (they each do something specific). |
| `OT/ICS Security` (vendor) | 6 | `primary_segment = ot_ics_cps_security` |
| `OT/ICS Security` (consulting) | 1 | `company_type = consulting_advisory`, `primary_segment = ot_ics_cps_security`, tag `ot_ics_consulting` |
| `OT/ICS Security` (asset owner) | 1 | **Mislabel** — clear segment; set real `industry_verticals`; `company_type = asset_owner_end_user` |
| `Oil and Gas` (asset owner) | 1 | `industry_verticals = [oil_gas, energy]`; no `primary_segment` |
| `OT ` (trailing space) | 1 | `primary_segment = ot_ics_cps_security` |
| `OT/ICS Security Risk Scoring` (Axio) | 1 | `primary_segment = grc_risk_compliance` (cyber risk quantification), `industry_verticals = [utilities, energy, oil_gas]` — heavy OT/utilities focus (founder David White co-wrote a major utilities cyber framework). |
| `(null)` | 1 | classify manually |

Backfill is ~29 rows by hand — a 20–30 minute pass once the fields exist.

### AI-native (17) → proposed `primary_segment` (Slice 2)

| Company | `primary_segment` | Note |
|---|---|---|
| 7AI, Artemis, Kai, Vega | `security_operations` | agentic SOC / SIEM (Kai also spans OT) |
| Tenex.ai | `security_operations` | **MDR service → `company_type = managed_security_provider`** |
| A Security, Armadin, Novee | `offensive_security_validation` | autonomous pentest / red team |
| Geordie AI, Helmet, Onyx, WitnessAI | `ai_security` | secures AI agents / usage |
| Gray Swan AI | `ai_security` (or offensive) | AI red-teaming — judgment call |
| Bold Security | `endpoint_security` | on-endpoint AI agent |
| depthfirst | `application_security` | AI code security |
| Jazz | `data_security` | AI-native DLP |
| Adaptive Security | `security_awareness_training` | reinstated category |

**Reclassifications confirmed (Slice 2):** Tenex → `managed_security_provider`; Copia Automation → `technology_vendor` (OT software/DevOps, not security — no security `primary_segment`); Axio → `grc_risk_compliance`; Anduril → fix the bogus "OT/ICS Security" label, default `asset_owner_end_user` (switch to `technology_vendor` if you engage their product teams), `industry_verticals = [defense, aerospace_space]`.

---

## Build sequence (each slice ships and tests independently)

1. ✅ **`is_ai_native` flag + AI-native filter** on the Companies list. Backfill the 17. *(Done 2026-06-27 — column + form toggle + filter, tsc clean, search smoke-tested.)*
2. ✅ **Expand `company_type`** (remap legacy values; add the new ones) **+ add `primary_segment`** (single-select, incl. `general_multi_domain`) + filters. Backfill all 29. *(Done 2026-06-27 — incl. ai_security primary, reinstated awareness, Tenex/Copia/Axio reclassified.)*
3. ✅ **Add `industry_verticals`** (`text[]`) + filter. *(Done 2026-06-27 — checkbox multi-select form + list filter + detail display; backfilled the 4 known asset/utility names.)*
4. **Add `secondary_segments`** (`text[]`) + filter. Seed a handful; grow organically.

> All filter-only. No changes to `global_search` / smart search. Per `SEARCH-RULES.md`, run the search smoke-test after each schema change anyway.
