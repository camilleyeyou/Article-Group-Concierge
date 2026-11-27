import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardText, guardOutputText, guardHeroRestatement, outputGuardEnabled, OUTPUT_GUARD_VERSION } from '../src/lib/output-guard';

// Real sentences from saved answers (06-DEMO rounds and eval/results runs).
const LEAKS: string[] = [
  "We also don't have a published partner event case study in what we pulled up, though our Salesforce/WhatsApp holiday virtual event is related work.",
  "Nothing we retrieved speaks to pricing, so we haven't shown client work.",
  "None of the work retrieved here speaks to pricing, so we haven't attached case studies to this answer.",
  'None of the work we retrieved was framed around budget size, so we are not citing a number.',
  'We cannot speak to foot traffic because none of the retrieved work addresses foot traffic.',
  "We have a related launch, though it wasn't retrieved here, so I can't detail it.",
  "We have an HHMI-adjacent project, though I haven't retrieved its details here.",
  "The selection I retrieved doesn't include a security-specific case study, so we are not claiming one.",
  "That is a pipeline story from the work I have in front of me, so I won't attach a pipeline number to it.",
  'We hold no further detail, and nothing we hold describes how analysts or brokers responded to a repositioning.',
  "Chrome Enterprise's Demo Day is the closest retrieved example, and it shows the format.",
];

const FILLER_A = 'We would start with your audience.';
const FILLER_B = 'Then we would test the story.';

test('each leak sentence is dropped, other sentences byte-for-byte unchanged', () => {
  for (const leak of LEAKS) {
    const input = `${FILLER_A} ${leak} ${FILLER_B}`;
    const r = guardText(input, { firstPerson: false });
    assert.equal(r.text, `${FILLER_A} ${FILLER_B}`, leak);
    assert.equal(r.changes.length, 1, leak);
    assert.equal(r.changes[0].rule, 'retrieval_leak');
    assert.equal(r.changes[0].action, 'drop_sentence');
    assert.equal(r.changes[0].before, leak);
  }
});

test('leak as last sentence trims the separator before it', () => {
  const r = guardText(`${FILLER_A}\n\nNothing we retrieved speaks to pricing, so we haven't shown client work.`);
  assert.equal(r.text, FILLER_A);
});

test('p3-q10 round3 narrative: 5 sentences become 4, no "pulled up"', () => {
  const s1 = 'Our Salesforce holiday virtual event is the closest match to a partner event.';
  const s2 = 'It paired a livestream with a WhatsApp follow-up.';
  const s3 = "We also don't have a published partner event case study in what we pulled up, though our Salesforce/WhatsApp holiday virtual event is related work.";
  const s4 = 'For your event, we would start with the audience.';
  const s5 = 'Then we would choose the format.';
  const r = guardText([s1, s2, s3, s4, s5].join(' '));
  assert.equal(r.text, [s1, s2, s4, s5].join(' '));
  assert.ok(!/pulled up/.test(r.text));
});

test('single-sentence leak field is kept unchanged as kept_unresolved', () => {
  const r = guardText('Nothing we retrieved fits');
  assert.equal(r.text, 'Nothing we retrieved fits');
  assert.equal(r.changes.length, 1);
  assert.equal(r.changes[0].action, 'kept_unresolved');
  assert.equal(r.changes[0].rule, 'retrieval_leak');
  assert.equal(r.changes[0].before, r.changes[0].after);
});

test('count a: "our two X" becomes "two of our X"', () => {
  const r = guardText("Salt Security and Chrome Enterprise's premium security tier are our two security examples, one led by brand and one by video.");
  assert.equal(r.text, "Salt Security and Chrome Enterprise's premium security tier are two of our security examples, one led by brand and one by video.");
  assert.equal(r.changes[0].rule, 'count_claim');
  assert.equal(r.changes[0].action, 'rewrite');
  assert.equal(guardText('Our two Salesforce engagements are the closest match to your challenge.').text, 'Two of our Salesforce engagements are the closest match to your challenge.');
  assert.equal(guardText('Our two Chrome SMB engagements show that discipline in practice.').text, 'Two of our Chrome SMB engagements show that discipline in practice.');
});

test('count b: "the two X in our portfolio" becomes "two of the X"', () => {
  assert.equal(
    guardText('These are the two cybersecurity studies in our portfolio.').text,
    'These are two of the cybersecurity studies in our portfolio.',
  );
});

test('count c: "the only X in our portfolio" becomes "a X"', () => {
  assert.equal(
    guardText("It's the only co-branded video study in our portfolio, so we can't show a range of pairings.", { firstPerson: false }).text,
    "It's a co-branded video study in our portfolio, so we can't show a range of pairings.",
  );
  assert.equal(
    guardText("AWS/NVIDIA is the only co-branded video case study we've published, and it's the closest match.").text,
    "AWS/NVIDIA is a co-branded video case study we've published, and it's the closest match.",
  );
  assert.equal(guardText('It is the only example in our portfolio.').text, 'It is an example in our portfolio.');
});

test('count d: "work covers two projects" becomes "work includes these two projects"', () => {
  assert.equal(
    guardText('Our cybersecurity work covers two projects: a brand and messaging rebuild for Salt and a video series.').text,
    'Our cybersecurity work includes these two projects: a brand and messaging rebuild for Salt and a video series.',
  );
});

test('first person: I becomes we', () => {
  assert.equal(
    guardText("Cost and speed depend on scope, and I can't responsibly give figures without knowing the brief.").text,
    "Cost and speed depend on scope, and we can't responsibly give figures without knowing the brief.",
  );
  assert.equal(
    guardText("We have no HHMI engagement in our portfolio that I can point to, so I can't walk you through it.").text,
    "We have no HHMI engagement in our portfolio that we can point to, so we can't walk you through it.",
  );
  assert.equal(guardText("It depends. I don't have a number.").text, "It depends. We don't have a number.");
  assert.equal(guardText("Happy to help, and I'm confident about that.").text, "Happy to help, and we're confident about that.");
  assert.equal(guardText("I'm sure of it.").text, "We're sure of it.");
  assert.equal(guardText("Here, I'd start with the audience.").text, "Here, we'd start with the audience.");
});

test('negative controls are unchanged with 0 changes', () => {
  const controls = [
    "We can't point to MetLife work in our portfolio, and nothing we've published shows how analysts or brokers responded to a repositioning.",
    "We haven't published restaurant work, so the two studies above are adjacent: one for a launch and one for a rebrand.",
    "For a launch, we'd define the single story people should hear first.",
    'This works in the context of a product launch.',
    "We'd start by choosing the two or three people whose stories carry the series.",
    'Our AI work is the closest parallel.',
    'Phase I is complete.',
    'We worked on J.P. Morgan terminals.',
    'Our I/O keynote work is related.',
  ];
  for (const c of controls) {
    const r = guardText(c);
    assert.equal(r.text, c);
    assert.equal(r.changes.length, 0, c);
  }
});

test('firstPerson: false leaves "I can\'t" unchanged', () => {
  const t = "I can't say.";
  const r = guardText(t, { firstPerson: false });
  assert.equal(r.text, t);
  assert.equal(r.changes.length, 0);
});

test('round-trip: no hits returns the identical string, markdown and paragraph breaks intact', () => {
  const t = 'First paragraph here.\n\n**On timing:** it depends on scope.\n\nThird bit.';
  const r = guardText(t);
  assert.ok(r.text === t);
  assert.equal(r.changes.length, 0);
});

test('idempotent over every fixture', () => {
  const fixtures = [
    ...LEAKS.map(l => `${FILLER_A} ${l} ${FILLER_B}`),
    'Our two Salesforce engagements are the closest match. I can\'t say more.',
    'These are the two cybersecurity studies in our portfolio.',
    "AWS/NVIDIA is the only co-branded video case study we've published.",
    'Our cybersecurity work covers two projects: a and b.',
    "Here, I'd start with the audience and I'm sure.",
  ];
  for (const f of fixtures) {
    const once = guardText(f);
    assert.equal(guardText(once.text).changes.length, 0, f);
  }
});

test('guardOutputText guards user-visible fields, leaves identity fields alone, no mutation', () => {
  const layout: any = {
    layout: [
      { component: 'HeroBlock', props: { title: 'Our two security examples', subtitle: 'Nothing we retrieved fits', challengeSummary: "I can't promise a number. We would scope it." } },
      { component: 'StrategyCard', props: { title: 'Plan', content: "Here, I'd start with the audience." } },
      { component: 'CaseStudyTeaser', props: { title: 'Our two X studies', slug: 'a-slug', thumbnailUrl: 'https://x/y.png', clientName: 'Our two Clients', summary: 'These are the two cybersecurity studies in our portfolio.' } },
      { component: 'CaseStudyTeaser', props: { title: 't2', slug: 'b-slug', summary: 'Plain summary.' } },
      { component: 'VideoPlayer', props: { url: 'https://v/our two examples', caption: 'It is the only example in our portfolio.' } },
      { component: 'MetricGrid', props: { stats: [{ label: 'Our two examples', value: 'Our two examples', context: 'Our two Salesforce engagements.' }] } },
    ],
  };
  const explanation = "We start here. We also don't have it in what we pulled up. Our two Chrome engagements fit.";
  const snapshot = structuredClone(layout);
  const r = guardOutputText(layout, explanation);
  assert.deepEqual(layout, snapshot);
  assert.equal(r.report.version, OUTPUT_GUARD_VERSION);
  const p = (i: number) => r.layout.layout[i].props as any;
  assert.equal(p(0).title, 'Two of our security examples');
  assert.equal(p(0).subtitle, 'Nothing we retrieved fits');
  assert.equal(p(0).challengeSummary, "We can't promise a number. We would scope it.");
  assert.equal(p(1).content, "Here, we'd start with the audience.");
  assert.equal(p(2).summary, 'These are two of the cybersecurity studies in our portfolio.');
  assert.equal(p(2).title, 'Our two X studies');
  assert.equal(p(2).slug, 'a-slug');
  assert.equal(p(2).thumbnailUrl, 'https://x/y.png');
  assert.equal(p(2).clientName, 'Our two Clients');
  assert.equal(p(4).url, 'https://v/our two examples');
  assert.equal(p(4).caption, 'It is an example in our portfolio.');
  assert.equal(p(5).stats[0].label, 'Our two examples');
  assert.equal(p(5).stats[0].value, 'Our two examples');
  assert.equal(p(5).stats[0].context, 'Two of our Salesforce engagements.');
  assert.equal(r.explanation, 'We start here. Two of our Chrome engagements fit.');
  const fields = r.report.changes.map(c => c.field);
  assert.ok(fields.includes('layout[0].HeroBlock.title'));
  assert.ok(fields.includes('layout[0].HeroBlock.subtitle'));
  assert.ok(fields.includes('layout[1].StrategyCard.content'));
  assert.ok(fields.includes('layout[2].CaseStudyTeaser.summary'));
  assert.ok(fields.includes('layout[4].VideoPlayer.caption'));
  assert.ok(fields.includes('layout[5].MetricGrid.stats[0].context'));
  assert.ok(fields.includes('explanation'));
});

test('outputGuardEnabled: true unless env equals "false"', () => {
  const prev = process.env.OUTPUT_GUARD_ENABLED;
  try {
    delete process.env.OUTPUT_GUARD_ENABLED;
    assert.equal(outputGuardEnabled(), true);
    process.env.OUTPUT_GUARD_ENABLED = 'false';
    assert.equal(outputGuardEnabled(), false);
    process.env.OUTPUT_GUARD_ENABLED = 'true';
    assert.equal(outputGuardEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env.OUTPUT_GUARD_ENABLED;
    else process.env.OUTPUT_GUARD_ENABLED = prev;
  }
});

test('first_person: a quoted visitor voice ("I\'m hungry") is not rewritten', () => {
  const s = 'You need a site that guides guests from "I\'m hungry" to "order placed" with as little friction as possible.';
  const r = guardText(s);
  assert.equal(r.text, s);
  assert.equal(r.changes.length, 0);
  const curly = 'Guests go from “I can’t decide” to “ordered”.';
  assert.equal(guardText(curly).text, curly);
  // an unquoted first-person is still rewritten
  assert.equal(guardText("I can't promise a date.").text, "We can't promise a date.");
});

const SIMONS = "We built the Simons Foundation's brand story and visual system, starting with a research discovery report.";

test('order_of_work: teaser summary ", starting with a ..." becomes ", including a ..."', () => {
  const layout = {
    layout: [{ component: 'CaseStudyTeaser', props: { title: 'Simons', clientName: 'Simons', summary: SIMONS, slug: 'simons' } }],
  } as never;
  const r = guardOutputText(layout, 'Fine.');
  const summary = (r.layout.layout[0].props as unknown as { summary: string }).summary;
  assert.equal(
    summary,
    "We built the Simons Foundation's brand story and visual system, including a research discovery report.",
  );
  const c = r.report.changes.find(x => x.rule === 'order_of_work');
  assert.ok(c);
  assert.equal(c.action, 'rewrite');
  assert.equal(c.field, 'layout[0].CaseStudyTeaser.summary');
});

test('order_of_work: beginning with the ... also rewritten in teaser summaries', () => {
  assert.equal(
    guardText('We shaped the identity, beginning with the audience research.', { orderOfWork: true }).text,
    'We shaped the identity, including the audience research.',
  );
});

test('order_of_work: not applied to explanations, strategy cards or by default; "start with" untouched', () => {
  assert.equal(guardText(SIMONS).text, SIMONS);
  const layout = {
    layout: [{ component: 'StrategyCard', props: { title: 'Plan', content: SIMONS } }],
  } as never;
  const r = guardOutputText(layout, SIMONS);
  assert.equal((r.layout.layout[0].props as unknown as { content: string }).content, SIMONS);
  assert.equal(r.explanation, SIMONS);
  const start = "We'd start with a short conversation, starting with your goals.";
  assert.equal(guardText("We'd start with a short conversation about your goals.", { orderOfWork: true }).text, "We'd start with a short conversation about your goals.");
  assert.equal(guardText(start).text, start);
});

// --- Phase 7 HERO-03: hero_restatement ---------------------------------------

const heroLayout = (props: Record<string, unknown>, extra: unknown[] = []): any => ({
  layout: [{ component: 'HeroBlock', props: { title: 'Rebrand your fintech', subtitle: 'How to rebrand a fintech startup', ...props } }, ...extra],
});

test('OUTPUT_GUARD_VERSION is 2', () => {
  assert.equal(OUTPUT_GUARD_VERSION, 2);
});

test('hero_restatement: all sentences restate -> challengeSummary removed, one drop_field', () => {
  const before = "You're launching a fintech rebrand. You're asking how to make it credible.";
  const input = heroLayout({ challengeSummary: before });
  const r = guardHeroRestatement(input, 'How do we rebrand a fintech startup?');
  const props = r.layout.layout[0].props as any;
  assert.ok(!('challengeSummary' in props));
  assert.deepEqual(r.changes, [
    { field: 'layout[0].HeroBlock.challengeSummary', rule: 'hero_restatement', action: 'drop_field', before, after: '' },
  ]);
});

test('hero_restatement: partial restatement -> restating sentence dropped', () => {
  const input = heroLayout({ challengeSummary: "Credibility has to come before novelty. You're asking how to rebrand." });
  const r = guardHeroRestatement(input, 'How do we rebrand a fintech startup?');
  assert.equal((r.layout.layout[0].props as any).challengeSummary, 'Credibility has to come before novelty.');
  assert.deepEqual(r.changes, [
    { field: 'layout[0].HeroBlock.challengeSummary', rule: 'hero_restatement', action: 'drop_sentence', before: "You're asking how to rebrand.", after: '' },
  ]);
});

test('hero_restatement: non-restating summary unchanged', () => {
  const input = heroLayout({ challengeSummary: "Looking credible enough to hold people's money while still feeling new." });
  const r = guardHeroRestatement(input, "We're a fintech startup looking to rebrand");
  assert.deepEqual(r.layout, input);
  assert.deepEqual(r.changes, []);
});

test('hero_restatement: no hero at 0, no summary, non-string summary -> unchanged', () => {
  const q = 'How do we rebrand?';
  const notFirst: any = { layout: [{ component: 'StrategyCard', props: { title: 't', content: "You're asking how to rebrand." } }, heroLayout({ challengeSummary: "You're asking how to rebrand." }).layout[0]] };
  for (const input of [notFirst, heroLayout({}), heroLayout({ challengeSummary: 42 }), heroLayout({ challengeSummary: '' }), { layout: [] } as any]) {
    const r = guardHeroRestatement(input, q);
    assert.deepEqual(r.layout, input);
    assert.deepEqual(r.changes, []);
  }
});

test('hero_restatement: title and subtitle never changed', () => {
  const input = heroLayout({ title: "You're asking how to rebrand a fintech startup", subtitle: 'How do we rebrand a fintech startup today', challengeSummary: "You're asking how to rebrand." });
  const r = guardHeroRestatement(input, 'How do we rebrand a fintech startup today?');
  const props = r.layout.layout[0].props as any;
  assert.equal(props.title, "You're asking how to rebrand a fintech startup");
  assert.equal(props.subtitle, 'How do we rebrand a fintech startup today');
  assert.ok(r.changes.every(c => c.field === 'layout[0].HeroBlock.challengeSummary'));
});

test('hero_restatement: input layout not mutated', () => {
  const input = heroLayout({ challengeSummary: "Credibility first. You're asking how to rebrand." });
  const snapshot = structuredClone(input);
  guardHeroRestatement(input, 'How do we rebrand?');
  assert.deepEqual(input, snapshot);
  const all = heroLayout({ challengeSummary: "You're asking how to rebrand." });
  const snap2 = structuredClone(all);
  guardHeroRestatement(all, 'How do we rebrand?');
  assert.deepEqual(all, snap2);
});
