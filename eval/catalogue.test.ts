import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tagsBySlug, formatCatalogue, extractDeliverables, catalogueVersion, CATALOGUE_RULE, CatalogueRow } from '../src/lib/catalogue';

const rows: CatalogueRow[] = [
  { slug: 'b-study', title: 'B', client: null, capabilities: ['Video', 'Brand'], industries: ['Tech'], hasVideo: true, deliverables: 'Solution included a film and a deck.' },
  { slug: 'a-study', title: 'A', client: 'Acme', capabilities: [], industries: [], hasVideo: false, deliverables: 'Solution included 3 films.' },
];

test('deterministic regardless of input order', () => {
  assert.equal(formatCatalogue(rows), formatCatalogue([...rows].reverse()));
});

test('sorted by slug, fixed field order, header and count', () => {
  const t = formatCatalogue(rows);
  assert.ok(t.startsWith(CATALOGUE_RULE));
  assert.ok(t.includes('2 case studies:'));
  assert.ok(t.indexOf('slug: a-study') < t.indexOf('slug: b-study'));
  assert.ok(t.includes('- B | client: n/a | slug: b-study | capabilities: Brand, Video | industries: Tech | video: yes | deliverables: Solution included a film and a deck.'));
});

test('deliverables with digits are dropped', () => {
  const line = formatCatalogue(rows).split('\n').find(l => l.includes('a-study'))!;
  assert.ok(!line.includes('deliverables'));
  assert.ok(line.includes('capabilities: n/a'));
});

test('extractDeliverables', () => {
  assert.equal(
    extractDeliverables('Acme wanted growth. Solution included a brand platform, launch film and sales deck. It grew 40%.'),
    'Solution included a brand platform, launch film and sales deck.'
  );
  assert.equal(extractDeliverables('Acme wanted growth.'), null);
});

test('catalogueVersion', () => {
  assert.match(catalogueVersion('x'), /^[0-9a-f]{12}$/);
  assert.equal(catalogueVersion('x'), catalogueVersion('x'));
  assert.notEqual(catalogueVersion('x'), catalogueVersion('y'));
});

test('tagsBySlug maps sorted tags per slug', () => {
  const m = tagsBySlug(rows);
  assert.deepEqual(m.get('b-study'), { capabilities: ['Brand', 'Video'], industries: ['Tech'] });
  assert.deepEqual(m.get('a-study'), { capabilities: [], industries: [] });
});
