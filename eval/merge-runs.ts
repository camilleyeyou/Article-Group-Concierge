/**
 * Merge a partial run with a re-run of its failed ids into one results dir.
 *
 * Takes every record + grade from --base except the ids present in --patch,
 * which come from --patch instead. Both runs must share the git commit, the
 * models, the grader model and the harness version. Writes
 * `eval/results/<base>-merged` (responses.json, grades.json, report.md via
 * writeReport). The source dirs are only read.
 *
 * Usage:
 *   npx tsx eval/merge-runs.ts --base eval/results/<partial> --patch eval/results/<rerun>
 */

import * as fs from 'fs';
import * as path from 'path';
import { RESULTS_DIR, argValue, readJson, writeJson, type GradesFile, type RunFile } from './lib';
import { writeReport } from './report';

export interface RunWithGrades {
  dir: string;
  run: RunFile;
  grades: GradesFile;
}

export function mergeRuns(base: RunWithGrades, patch: RunWithGrades): { run: RunFile; grades: GradesFile } {
  if (base.run.git_commit !== patch.run.git_commit) {
    throw new Error(`git_commit differs: ${base.run.git_commit} vs ${patch.run.git_commit}`);
  }
  if (JSON.stringify(base.run.models ?? null) !== JSON.stringify(patch.run.models ?? null)) {
    throw new Error('models differ between base and patch');
  }
  if (base.grades.grader_model !== patch.grades.grader_model) {
    throw new Error(`grader_model differs: ${base.grades.grader_model} vs ${patch.grades.grader_model}`);
  }
  if ((base.grades.harness_version ?? 1) !== (patch.grades.harness_version ?? 1)) {
    throw new Error('harness_version differs between base and patch');
  }

  const baseIds = new Set(base.run.records.map(r => r.id));
  const patchRecords = new Map(patch.run.records.map(r => [r.id, r]));
  const patchGrades = new Map(patch.grades.grades.map(g => [g.id, g]));
  for (const id of patchRecords.keys()) {
    if (!baseIds.has(id)) throw new Error(`patch id ${id} is not in base`);
    if (!patchGrades.has(id)) throw new Error(`patch id ${id} has no grade`);
  }
  for (const r of base.run.records) {
    if (patchRecords.has(r.id) && r.status === 'ok') {
      throw new Error(`base record ${r.id} is ok; only failed records may be replaced`);
    }
  }
  const baseGrades = new Map(base.grades.grades.map(g => [g.id, g]));

  const records = base.run.records.map(r => patchRecords.get(r.id) ?? r);
  const grades = base.run.records
    .map(r => patchGrades.get(r.id) ?? baseGrades.get(r.id))
    .filter((g): g is NonNullable<typeof g> => g !== undefined);
  const patchIds = [...patchRecords.keys()];
  const baseKept = base.run.records.filter(r => !patchRecords.has(r.id)).map(r => r.id);

  const run: RunFile = {
    ...base.run,
    finished_at: patch.run.finished_at,
    query_count: records.length,
    records,
    merged_from: [
      {
        dir: path.basename(base.dir),
        git_commit: base.run.git_commit,
        started_at: base.run.started_at,
        finished_at: base.run.finished_at,
        ids: baseKept,
      },
      {
        dir: path.basename(patch.dir),
        git_commit: patch.run.git_commit,
        started_at: patch.run.started_at,
        finished_at: patch.run.finished_at,
        ids: patchIds,
      },
    ],
  };
  return { run, grades: { ...base.grades, grades } };
}

function load(dir: string): RunWithGrades {
  return {
    dir,
    run: readJson<RunFile>(path.join(dir, 'responses.json')),
    grades: readJson<GradesFile>(path.join(dir, 'grades.json')),
  };
}

if (require.main === module) {
  const baseArg = argValue('--base');
  const patchArg = argValue('--patch');
  if (!baseArg || !patchArg) {
    console.error('Usage: npx tsx eval/merge-runs.ts --base <dir> --patch <dir>');
    process.exit(1);
  }
  const baseDir = path.resolve(baseArg);
  const patchDir = path.resolve(patchArg);
  const outDir = path.join(RESULTS_DIR, `${path.basename(baseDir)}-merged`);
  if (fs.existsSync(outDir)) {
    console.error(`${outDir} already exists`);
    process.exit(1);
  }
  const merged = mergeRuns(load(baseDir), load(patchDir));
  writeJson(path.join(outDir, 'responses.json'), merged.run);
  writeJson(path.join(outDir, 'grades.json'), merged.grades);
  writeReport(outDir);
  const ok = merged.run.records.filter(r => r.status === 'ok').length;
  console.log(`Merged ${merged.run.records.length} records (${ok} ok) into ${outDir}`);
}
