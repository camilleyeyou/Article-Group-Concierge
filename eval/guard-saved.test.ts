import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadSavedAnswers, replayAnswers, type SavedAnswer } from './guard-saved';

const layout = (summary = 'Salt Security work.') => ({
  layout: [{ component: 'CaseStudyTeaser', props: { title: 'Salt', clientName: 'Salt', summary, slug: 's' } }],
});
const ans = (explanation: string, grades: SavedAnswer['grades'] = []): SavedAnswer => ({
  answer_id: 'r:p1-q01',
  run: 'r',
  id: 'p1-q01',
  response: { layoutPlan: layout(), explanation },
  grades,
});

test('loadSavedAnswers reads responses.json records with a response', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-'));
  const run = path.join(dir, 'run1');
  fs.mkdirSync(run);
  fs.writeFileSync(
    path.join(run, 'responses.json'),
    JSON.stringify({
      records: [
        { id: 'a', response: { layoutPlan: layout(), explanation: 'We help.' } },
        { id: 'b', response: null },
      ],
    }),
  );
  const got = loadSavedAnswers({ dir: run });
  assert.equal(got.length, 1);
  assert.equal(got[0].answer_id, 'run1:a');
});

test('replay reports changes, narrative counts and below_min', () => {
  const [r] = replayAnswers([ans('We built the work. Nothing we retrieved speaks to pricing.')]);
  assert.equal(r.changes.length, 1);
  assert.equal(r.changes[0].rule, 'retrieval_leak');
  assert.equal(r.narrative_before, 2);
  assert.equal(r.narrative_after, 1);
  assert.equal(r.below_min, true);
});

test('graded claim removed when its quoted fragment is rewritten away', () => {
  const [r] = replayAnswers([
    ans('Salt and Chrome are our two security examples.', [
      { claim_index: 0, kind: 'other', claim: "Narrative calls them 'our two security examples'" },
    ]),
  ]);
  assert.equal(r.graded_claims_removed.length, 1);
});

test('answer with no changes is identical after the guard', () => {
  const [r] = replayAnswers([ans('We built brand work for Salt. It shipped well.')]);
  assert.equal(r.unchanged, true);
  assert.equal(r.explanation_after, r.explanation_before);
  assert.equal(r.below_min, false);
});
