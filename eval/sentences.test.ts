import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countSentences } from '../src/lib/sentences';

const P1_Q02 = "We haven't published a case study where a challenger took on a much larger incumbent's category language, so neither study above is a direct match. Your challenge is really about repositioning in a market where someone else has set the vocabulary, and our Salt Security work is the closest parallel. Salt sat on the other side of the dynamic, defending an innovator's position against newer rivals, but the method transfers: test territories with the audience, then build a unified narrative that turns features into benefits. The Chrome Enterprise work is further afield. It shows how we help an established brand reassert relevance by shifting the conversation to what buyers care about now, which is the same muscle you'd use to move analyst framing off the incumbent's terms.";

const cases: Array<[string, string, number]> = [
  ['two plain', "We built X. We'd start with Y.", 2],
  ['re:MARS', "Our re:MARS work shows it. We'd start.", 2],
  ['colon number', "We made a :90 explainer. It ran.", 2],
  ['abbreviations', 'e.g. the U.S. launch went out. Next one.', 2],
  ['plus and exclamation', 'It got 8M+ views. Our Strategy Lead can help!', 2],
  ['question', 'Is it right? Yes.', 2],
  ['markdown', "**Short answer:** no. We can't.", 2],
  ['decimal', 'One sentence with 3.5x growth', 1],
  ['J.P. initials', 'Our J.P. Morgan work named the terminals. We would start with your buyers.', 2],
  ['empty', '', 0],
  ['whitespace', '   ', 0],
];
for (const [name, text, n] of cases) {
  test('countSentences: ' + name, () => assert.equal(countSentences(text), n));
}
test('countSentences: null/undefined', () => {
  assert.equal(countSentences(null), 0);
  assert.equal(countSentences(undefined), 0);
});
test('countSentences: gap run p1-q02 explanation', () => assert.equal(countSentences(P1_Q02), 5));
