import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractQuantities, metricValueInContext } from './numbers';

test('8M+ matches "over 8 million"', () => {
  assert.equal(metricValueInContext('8M+', 'achieving over 8 million combined views'), true);
});

test('"over 8 million" matches 8M+', () => {
  assert.equal(metricValueInContext('over 8 million', 'reached 8M+ views'), true);
});

test('8,000,000 matches "over 8 million"', () => {
  assert.equal(metricValueInContext('8,000,000', 'over 8 million views'), true);
});

test('40% matches "40 percent"', () => {
  assert.equal(metricValueInContext('40%', 'a 40 percent lift'), true);
});

test('40% does not match "40 new markets" (unit mismatch)', () => {
  assert.equal(metricValueInContext('40%', 'launched in 40 new markets'), false);
});

test('3x matches "three times"', () => {
  assert.equal(metricValueInContext('3x', 'three times more sign-ups'), true);
});

test('9M does not match "over 8 million"', () => {
  assert.equal(metricValueInContext('9M', 'over 8 million views'), false);
});

test('$1.5B matches "1.5 billion dollars"', () => {
  assert.equal(metricValueInContext('$1.5B', '1.5 billion dollars in pipeline'), true);
});

test('1.5k matches "1,500"', () => {
  assert.equal(metricValueInContext('1.5k', '1,500 attendees'), true);
});

test('12 matches "twelve"', () => {
  assert.equal(metricValueInContext('12', 'twelve markets'), true);
});

test('number-free value falls back to substring (match)', () => {
  assert.equal(metricValueInContext('Doubled', 'pipeline doubled in a year'), true);
});

test('number-free value falls back to substring (miss)', () => {
  assert.equal(metricValueInContext('Doubled', 'pipeline grew'), false);
});

test('+340% is flagged when the context has no such number', () => {
  assert.equal(metricValueInContext('+340%', 'brand awareness rose sharply'), false);
});

test('extractQuantities: plain numbers with separators', () => {
  assert.deepEqual(extractQuantities('2,500 partners in 40 countries'), [
    { value: 2500, unit: 'plain' },
    { value: 40, unit: 'plain' },
  ]);
});

test('extractQuantities: "8 more" is not a scale', () => {
  assert.deepEqual(extractQuantities('8 more'), [{ value: 8, unit: 'plain' }]);
});

test('extractQuantities: "5 min" is not a scale', () => {
  assert.deepEqual(extractQuantities('5 min'), [{ value: 5, unit: 'plain' }]);
});

test('extractQuantities: percent unit', () => {
  assert.deepEqual(extractQuantities('25%'), [{ value: 25, unit: 'percent' }]);
});
