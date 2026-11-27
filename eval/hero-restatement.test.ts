import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectHeroRestatement,
  heroRestatementGuardEnabled,
  HERO_RESTATEMENT_CONFIG,
  HERO_RESTATEMENT_VERSION,
} from '../src/lib/hero-restatement';

// Real fixtures copied verbatim from eval/results/2026-11-26T05-24-15 (user-visible hero).
const P1Q01 = {
  query:
    "We're launching a second product that carves out a new sub-category next to our core API security platform, and analysts keep missing the platform story. Have you built a marketecture for a security company that sales actually adopted in the field, and how did you get from positioning to the visual?",
  summary:
    "You're launching a second product that carves out a new sub-category beside your core API security platform, and analysts keep missing the platform story. You're asking how positioning becomes a visual marketecture that sales adopt in the field.",
};
const P1Q04 = {
  query:
    "Our sales decks are all over the place: every AE has their own version of the pitch and the messaging house isn't making it into the field. What does your sales enablement work look like, and how do you get marketing and sales aligned on one narrative?",
  summary:
    "Every AE has their own version of the pitch, and the messaging house isn't making it into the field. You want marketing and sales telling one story.",
};
const P4Q04 = {
  query:
    "Our researchers are a tough audience. If they think the new brand is marketing gloss, they won't use it, and they'll say so loudly. How do you bring scientists and internal experts into the process so the end result is something they actually respect?",
  summary:
    "Your researchers are a tough audience: if they read the new brand as marketing gloss, they won't use it and they'll say so. You're asking how to involve them so the result earns their respect.",
};
const P5Q07 = {
  query: 'small budget ok?',
  summary: "You're asking whether a small budget is workable, and how to get the most from it.",
};
// The system prompt's own fictional hero example (src/lib/orchestrator.ts EXAMPLE INTERACTION).
const FICTIONAL = {
  query:
    "We're a fintech startup looking to rebrand and redesign our app. What can you show us, and how long would it take?",
  summary: "Looking credible enough to hold people's money while still feeling new.",
};

test('version and config are exported', () => {
  assert.equal(HERO_RESTATEMENT_VERSION, 2);
  assert.equal(HERO_RESTATEMENT_CONFIG.verbatimRun, 6);
});

test('p1-q01 restates via you_opener, asking_frame and verbatim_run', () => {
  const r = detectHeroRestatement(P1Q01.query, P1Q01.summary);
  assert.equal(r.restates, true);
  assert.deepEqual(r.signals, ['you_opener', 'asking_frame', 'verbatim_run']);
  assert.ok(r.longestRun >= 6);
});

test('p1-q04 restates via verbatim_run without a You opener', () => {
  const r = detectHeroRestatement(P1Q04.query, P1Q04.summary);
  assert.equal(r.restates, true);
  assert.ok(!r.signals.includes('you_opener'));
  assert.ok(r.signals.includes('verbatim_run'));
});

test('p4-q04 restates via verbatim_run; "Your researchers" is not a you_opener', () => {
  const r = detectHeroRestatement(P4Q04.query, P4Q04.summary);
  assert.equal(r.restates, true);
  assert.ok(!r.signals.includes('you_opener'));
  assert.ok(r.signals.includes('verbatim_run'));
});

test('p5-q07 short query restates', () => {
  const r = detectHeroRestatement(P5Q07.query, P5Q07.summary);
  assert.equal(r.restates, true);
  assert.ok(r.signals.includes('asking_frame'));
});

test('curly apostrophe asking frame restates', () => {
  const r = detectHeroRestatement('Can you help with a launch?', 'You’re asking about a launch plan.');
  assert.equal(r.restates, true);
  assert.ok(r.signals.includes('asking_frame'));
  assert.ok(r.signals.includes('you_opener'));
});

test('fictional prompt example is not flagged', () => {
  const r = detectHeroRestatement(FICTIONAL.query, FICTIONAL.summary);
  assert.equal(r.restates, false);
  assert.deepEqual(r.signals, []);
});

test('"Your partners need" is not a restatement', () => {
  const r = detectHeroRestatement(
    'Our partners keep asking for customer stories they can reuse.',
    'Your partners need proof they can carry into their own pitches.',
  );
  assert.equal(r.restates, false);
  assert.deepEqual(r.signals, []);
  assert.ok(r.longestRun < 6);
});

test('verbatim threshold: 5 shared words is not enough, 6 is', () => {
  const query = 'alpha bravo charlie delta echo foxtrot golf hotel';
  const five = detectHeroRestatement(query, 'Zulu alpha bravo charlie delta echo yankee.');
  assert.equal(five.longestRun, 5);
  assert.equal(five.restates, false);
  const six = detectHeroRestatement(query, 'Zulu alpha bravo charlie delta echo foxtrot yankee.');
  assert.equal(six.longestRun, 6);
  assert.equal(six.restates, true);
  assert.deepEqual(six.signals, ['verbatim_run']);
});

test('empty, null and undefined summaries are not flagged', () => {
  for (const s of [undefined, null, '']) {
    const r = detectHeroRestatement('anything at all here', s);
    assert.deepEqual(r, { restates: false, signals: [], longestRun: 0, overlap: 0, contentTokens: 0 });
  }
});

test('overlap is informational and bounded', () => {
  const r = detectHeroRestatement(P1Q01.query, P1Q01.summary);
  assert.ok(r.overlap > 0 && r.overlap <= 1);
  assert.ok(r.contentTokens > 0);
  const f = detectHeroRestatement(FICTIONAL.query, FICTIONAL.summary);
  assert.ok(f.overlap >= 0 && f.overlap <= 1);
});

test('HERO_RESTATEMENT_GUARD_ENABLED switch', () => {
  const prev = process.env.HERO_RESTATEMENT_GUARD_ENABLED;
  try {
    process.env.HERO_RESTATEMENT_GUARD_ENABLED = 'false';
    assert.equal(heroRestatementGuardEnabled(), false);
    delete process.env.HERO_RESTATEMENT_GUARD_ENABLED;
    assert.equal(heroRestatementGuardEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env.HERO_RESTATEMENT_GUARD_ENABLED;
    else process.env.HERO_RESTATEMENT_GUARD_ENABLED = prev;
  }
});

// Phase 7 07-03 guard replay review: false positives found in saved answers (regressions).
test('07-03 FP: "You can\'t ..." reframe is not a you_opener', () => {
  const q = "a big chain is opening right down the street from one of our places. how do we compete with them, we're just a family business";
  for (const s of [
    "You can't match their scale, so the answer is to own a story they can't tell.",
    "You can't match their budget or footprint, but you can own a story they can't tell.",
    "You can't out-spend a chain, and you shouldn't try.",
  ]) {
    assert.equal(detectHeroRestatement(q, s).restates, false, s);
  }
});

test('07-03 FP: embedded "what you want/need" is not an asking frame', () => {
  assert.equal(
    detectHeroRestatement('messaging for policymakers?', 'Reaching them takes a message built around what they need to decide, not what you want to say.').restates,
    false,
  );
  assert.equal(detectHeroRestatement('how much do u charge', 'What you invest depends on what you need built.').restates, false);
  assert.equal(
    detectHeroRestatement('how much do u charge', 'Understanding what a engagement could look like starts with understanding what you need built.').restates,
    false,
  );
  // A frame that addresses the user's want still counts.
  assert.equal(detectHeroRestatement('how much do u charge', 'You want to know what working with us costs.').restates, true);
  assert.equal(detectHeroRestatement('small budget ok?', 'So you want to know if a small budget works.').restates, true);
});

test('07-03 FP: "behind your question" reframe is not an asking frame', () => {
  const q = 'A colleague told me you did the public engagement campaign for the Howard Hughes Medical Institute a couple of years ago. Can you walk me through what you did for them and how it performed?';
  assert.equal(detectHeroRestatement(q, 'The capability behind your question is turning serious research into public engagement.').restates, false);
  assert.equal(detectHeroRestatement(q, 'Here is the work and thinking that comes closest to your question.').restates, true);
});
