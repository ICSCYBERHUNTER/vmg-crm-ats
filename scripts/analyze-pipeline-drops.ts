import * as fs from "fs";
import * as path from "path";

// ── Types ────────────────────────────────────────────────────────────────────

interface PositiveExpectation {
  candidate_id: string;
  candidate_name: string;
  min_rank?: number;
  reason?: string;
}

interface CorpusEntry {
  id: string;
  category: string;
  query: string;
  scope: string;
  include_notes: boolean;
  positive_expectations: PositiveExpectation[];
}

interface PipelineIds {
  hybrid_rows: string[];
  after_hydration: string[];
  after_scope_filter: string[];
  after_location_filter: string[];
  after_candidate_hard_filter: string[];
  returned: string[];
}

interface Counts {
  hybrid_rows: number;
  after_hydration: number;
  after_scope_filter: number;
  after_location_filter: number;
  after_candidate_hard_filter: number;
  rerank_candidates?: number;
  returned: number;
}

interface ParsedFilters {
  location?: { fired: boolean; states: string[] };
  candidate_hard?: {
    fired: boolean;
    categories: string[] | null;
    manages_people: boolean | null;
  };
  [key: string]: unknown;
}

interface Debug {
  pipeline_ids: PipelineIds;
  counts: Counts;
  parsed_filters: ParsedFilters;
}

interface ResultFile {
  corpus_entry: CorpusEntry;
  response: {
    status: number;
    ok: boolean;
    body: {
      success: boolean;
      data: {
        results: unknown[];
        _debug: Debug;
      };
    };
  };
}

type DropPoint =
  | "never_retrieved"
  | "filtered_scope"
  | "filtered_location"
  | "filtered_hard"
  | "reranked_out"
  | "returned";

interface CandidateDrop {
  candidate_id: string;
  candidate_name: string;
  drop_point: DropPoint;
}

interface QueryAnalysis {
  query_id: string;
  query_text: string;
  filters_summary: string;
  cliff_summary: string;
  candidate_drops: CandidateDrop[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function determineDropPoint(
  candidateId: string,
  pipelineIds: PipelineIds
): DropPoint {
  if (!pipelineIds.hybrid_rows.includes(candidateId)) return "never_retrieved";
  if (!pipelineIds.after_scope_filter.includes(candidateId))
    return "filtered_scope";
  if (!pipelineIds.after_location_filter.includes(candidateId))
    return "filtered_location";
  if (!pipelineIds.after_candidate_hard_filter.includes(candidateId))
    return "filtered_hard";
  if (!pipelineIds.returned.includes(candidateId)) return "reranked_out";
  return "returned";
}

function formatFilters(parsed: ParsedFilters): string {
  const parts: string[] = [];

  const loc = parsed.location;
  if (loc) {
    parts.push(
      loc.fired
        ? `location=${loc.states.length ? loc.states.join(",") : "any"}`
        : "location=none"
    );
  }

  const hard = parsed.candidate_hard;
  if (hard) {
    if (hard.categories !== null && hard.categories !== undefined) {
      parts.push(`categories=${hard.categories.join(",")}`);
    } else {
      parts.push("categories=null");
    }
    parts.push(`manages_people=${hard.manages_people ?? "null"}`);
  }

  return parts.length ? parts.join(", ") : "none";
}

function formatCliff(counts: Counts): string {
  return [
    `hybrid=${counts.hybrid_rows}`,
    `hydration=${counts.after_hydration}`,
    `scope=${counts.after_scope_filter}`,
    `location=${counts.after_location_filter}`,
    `hard_filter=${counts.after_candidate_hard_filter}`,
    `returned=${counts.returned}`,
  ].join(" → ");
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: npx tsx scripts/analyze-pipeline-drops.ts <run-dir>"
    );
    process.exit(1);
  }

  const runDir = path.resolve(args[0]);
  if (!fs.existsSync(runDir)) {
    console.error(`Run directory not found: ${runDir}`);
    process.exit(1);
  }

  const runId = path.basename(runDir);

  // Read corpus
  const corpusPath = path.resolve("scripts/audit-corpus.json");
  if (!fs.existsSync(corpusPath)) {
    console.error(`Corpus not found: ${corpusPath}`);
    process.exit(1);
  }
  const corpus: CorpusEntry[] = JSON.parse(
    fs.readFileSync(corpusPath, "utf-8")
  );
  const corpusMap = new Map(corpus.map((e) => [e.id, e]));

  // Read all result files
  const files = fs
    .readdirSync(runDir)
    .filter((f) => f.endsWith(".json") && f !== "_summary.json")
    .sort();

  const analyses: QueryAnalysis[] = [];
  let totalExpected = 0;

  for (const file of files) {
    const filePath = path.join(runDir, file);
    let result: ResultFile;
    try {
      result = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      console.warn(`WARN: Could not parse ${file} — skipping`);
      continue;
    }

    const corpusEntry =
      result.corpus_entry ?? corpusMap.get(path.basename(file, ".json"));
    if (!corpusEntry) {
      console.warn(`WARN: No corpus entry found for ${file} — skipping`);
      continue;
    }

    const expectations = corpusEntry.positive_expectations ?? [];
    if (expectations.length === 0) continue;

    // Validate debug structure
    const debug = result.response?.body?.data?._debug;
    if (!debug) {
      console.warn(`WARN: No _debug in ${file} — skipping`);
      continue;
    }
    if (!debug.pipeline_ids) {
      console.warn(`WARN: No pipeline_ids in ${file} — skipping`);
      continue;
    }

    const drops: CandidateDrop[] = [];
    for (const exp of expectations) {
      totalExpected++;
      const dropPoint = determineDropPoint(exp.candidate_id, debug.pipeline_ids);
      drops.push({
        candidate_id: exp.candidate_id,
        candidate_name: exp.candidate_name,
        drop_point: dropPoint,
      });
    }

    analyses.push({
      query_id: corpusEntry.id,
      query_text: corpusEntry.query,
      filters_summary: formatFilters(debug.parsed_filters ?? {}),
      cliff_summary: formatCliff(debug.counts),
      candidate_drops: drops,
    });
  }

  // ── Console output ───────────────────────────────────────────────────────

  console.log(`\n=== PHASE 1C TRIAGE: Pipeline Drop Analysis ===`);
  console.log(`Run: ${runId}`);
  console.log(`Queries with expectations: ${analyses.length} of ${files.length}`);
  console.log(`Total expected candidates: ${totalExpected}`);

  console.log(`\n--- PER-QUERY DETAIL ---`);

  for (const a of analyses) {
    console.log(`\n[${a.query_id}] "${a.query_text}"`);
    console.log(`  Filters: ${a.filters_summary}`);
    console.log(`  Cliff: ${a.cliff_summary}`);
    console.log(`  Expected candidates:`);
    for (const c of a.candidate_drops) {
      const status =
        c.drop_point === "returned"
          ? "RETURNED (success)"
          : c.drop_point.toUpperCase().replace(/_/g, " ");
      console.log(
        `    ${c.candidate_name} (${c.candidate_id.slice(0, 8)}...) → ${status}`
      );
    }
  }

  // ── Summary by drop point ────────────────────────────────────────────────

  const dropBuckets: Record<DropPoint, CandidateDrop[]> = {
    never_retrieved: [],
    filtered_scope: [],
    filtered_location: [],
    filtered_hard: [],
    reranked_out: [],
    returned: [],
  };

  for (const a of analyses) {
    for (const c of a.candidate_drops) {
      dropBuckets[c.drop_point].push(c);
    }
  }

  console.log(`\n--- SUMMARY BY DROP POINT ---`);
  const order: DropPoint[] = [
    "never_retrieved",
    "filtered_scope",
    "filtered_location",
    "filtered_hard",
    "reranked_out",
    "returned",
  ];
  for (const dp of order) {
    const bucket = dropBuckets[dp];
    const names = bucket.map((c) => c.candidate_name).join(", ") || "—";
    const label = dp.padEnd(20);
    console.log(`  ${label} ${bucket.length} candidates  (${names})`);
  }

  // ── Write JSON output ────────────────────────────────────────────────────

  const outputPath = path.resolve(
    `scripts/output/pipeline-drop-analysis-${runId}.json`
  );

  const jsonOut = {
    run_id: runId,
    queries_with_expectations: analyses.length,
    total_queries_in_run: files.length,
    total_expected_candidates: totalExpected,
    summary_by_drop_point: Object.fromEntries(
      order.map((dp) => [
        dp,
        {
          count: dropBuckets[dp].length,
          candidates: dropBuckets[dp].map((c) => ({
            candidate_id: c.candidate_id,
            candidate_name: c.candidate_name,
          })),
        },
      ])
    ),
    per_query: analyses,
  };

  fs.writeFileSync(outputPath, JSON.stringify(jsonOut, null, 2));
  console.log(`\nFull analysis written to: ${outputPath}\n`);
}

main();
