/**
 * Contract for production timing batches (written by the timing client, read by
 * eval/proof-report.ts). Types only.
 */

export interface ProdPerfFlags {
  rag_cache_hit: 0 | 1 | null;
  embed_cache_hit: 0 | 1 | null;
  orch_cached: boolean | null;
  instance_req: number | null;
  instance_age_s: number | null;
}

export interface ProdTimingRecord {
  id: string;
  type: string;
  warmup: boolean;
  t_teasers_ms: number | null;
  t_suppressed_ms: number | null;
  t_hero_first_ms: number | null;
  t_hero_done_ms: number | null;
  t_complete_ms: number | null;
  aborted_after_hero: boolean;
  http_status: number | null;
  perf: ProdPerfFlags | null;
  error: string | null;
  started_at: string;
}

export interface ProdTimingFile {
  batch: number;
  base_url: string;
  git_commit_expected: string | null;
  runner: {
    country: string | null;
    region: string | null;
    city: string | null;
    org: string | null;
    github_run_id: string | null;
  };
  started_at: string;
  finished_at: string | null;
  ids: string[];
  records: ProdTimingRecord[];
}
