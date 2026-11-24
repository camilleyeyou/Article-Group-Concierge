/**
 * Incremental parser for the model's unchanged output format:
 *
 *   ```json
 *   { "layout": [ {HeroBlock}, {...}, ... ] }
 *   ```
 *   narrative text
 *   **Want to explore further?** ...
 *
 * It lets the route preview the hero as it is written and every other component
 * only once its JSON object is complete (never a half-written metric or card).
 * The end-of-stream whole-response parse stays authoritative: this parser never
 * throws, and after `abandoned` it only accumulates text.
 *
 * Leading prose before the fence is tolerated but not previewed as narrative.
 * Pure module: no imports.
 */

export type ParserEvent =
  | {
      type: 'hero';
      title?: string;
      subtitle?: string;
      challengeSummary?: string;
      backgroundVariant?: 'dark' | 'light' | 'gradient';
    } // cumulative
  | { type: 'hero_done'; props: Record<string, unknown> }
  | { type: 'component'; index: number; component: string; props: Record<string, unknown> }
  | { type: 'narrative'; text: string } // delta
  | { type: 'abandoned'; reason: string };

type State = 'seek_fence' | 'seek_layout_array' | 'in_items' | 'seek_fence_close' | 'narrative' | 'followups' | 'abandoned';

const FENCE = '```json';
const MARKER = '**Want to explore';
const MAX_PREFIX_NONWS = 400;
const MAX_LAYOUT_KEY_DISTANCE = 300;
const VARIANTS = ['dark', 'light', 'gradient'] as const;
const HERO_STRING_KEYS = ['title', 'subtitle', 'challengeSummary'] as const;

const SIMPLE_ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
  '/': '/',
  '"': '"',
  '\\': '\\',
};

interface Decoded {
  value: string;
  complete: boolean;
  end: number; // index after the closing quote when complete
}

/** Decode a JSON string starting at s[i] === '"'. Holds back an incomplete trailing escape. */
function decodeString(s: string, i: number): Decoded {
  let j = i + 1;
  let out = '';
  while (j < s.length) {
    const c = s[j];
    if (c === '"') return { value: out, complete: true, end: j + 1 };
    if (c === '\\') {
      if (j + 1 >= s.length) break;
      const n = s[j + 1];
      if (n === 'u') {
        if (j + 6 > s.length) break;
        const hex = s.slice(j + 2, j + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) break;
        out += String.fromCharCode(parseInt(hex, 16));
        j += 6;
      } else {
        out += SIMPLE_ESCAPES[n] ?? n;
        j += 2;
      }
    } else {
      out += c;
      j++;
    }
  }
  // Incomplete: never end on a lone high surrogate (keeps partials a true prefix).
  if (out.length > 0) {
    const last = out.charCodeAt(out.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) out = out.slice(0, -1);
  }
  return { value: out, complete: false, end: s.length };
}

function skipWs(s: string, i: number): number {
  while (i < s.length && /\s/.test(s[i])) i++;
  return i;
}

/** Index just after the value starting at s[i], or -1 when the value is not complete yet. */
function skipValue(s: string, i: number): number {
  const c = s[i];
  if (c === '"') {
    const d = decodeString(s, i);
    return d.complete ? d.end : -1;
  }
  if (c === '{' || c === '[') {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) return j + 1;
      }
    }
    return -1;
  }
  let j = i;
  while (j < s.length && !/[,}\]\s]/.test(s[j])) j++;
  return j >= s.length ? -1 : j;
}

type HeroFields = Omit<Extract<ParserEvent, { type: 'hero' }>, 'type'>;

/** Walk "key": value pairs of the object whose '{' is at s[start]; visit may stop the walk by returning true. */
function walkPairs(
  s: string,
  start: number,
  visit: (key: string, valueIdx: number) => boolean | 'skip'
): void {
  let i = start + 1;
  for (;;) {
    i = skipWs(s, i);
    while (i < s.length && s[i] === ',') i = skipWs(s, i + 1);
    if (i >= s.length || s[i] !== '"') return;
    const k = decodeString(s, i);
    if (!k.complete) return;
    i = skipWs(s, k.end);
    if (i >= s.length || s[i] !== ':') return;
    i = skipWs(s, i + 1);
    if (i >= s.length) return;
    const r = visit(k.value, i);
    if (r === true) return;
    const e = skipValue(s, i);
    if (e < 0) return;
    i = e;
  }
}

/** Partial hero fields from an incomplete item text starting at '{'; null until it is known to be a HeroBlock. */
function partialHero(item: string): HeroFields | null {
  let isHero: boolean | null = null;
  let fields: HeroFields | null = null;
  walkPairs(item, 0, (key, vi) => {
    if (key === 'component' && item[vi] === '"') {
      const d = decodeString(item, vi);
      if (d.complete) isHero = d.value === 'HeroBlock';
      return 'skip';
    }
    if (key === 'props' && item[vi] === '{') {
      if (isHero !== true) return true;
      const f: HeroFields = {};
      walkPairs(item, vi, (pk, pvi) => {
        if (item[pvi] !== '"') return 'skip';
        if ((HERO_STRING_KEYS as readonly string[]).includes(pk)) {
          const d = decodeString(item, pvi);
          (f as Record<string, string>)[pk] = d.value;
          return d.complete ? 'skip' : true;
        }
        if (pk === 'backgroundVariant') {
          const d = decodeString(item, pvi);
          if (d.complete && (VARIANTS as readonly string[]).includes(d.value)) {
            f.backgroundVariant = d.value as (typeof VARIANTS)[number];
          }
          return d.complete ? 'skip' : true;
        }
        return 'skip';
      });
      fields = f;
      return true;
    }
    return 'skip';
  });
  return fields;
}

export class StreamLayoutParser {
  private text = '';
  private state: State = 'seek_fence';
  private pos = 0; // next unprocessed index in text

  // item scanning
  private itemIndex = 0;
  private itemStart = -1;
  private scanI = 0;
  private depth = 0;
  private inStr = false;
  private esc = false;
  private lastHeroKey = '';

  // narrative
  private narrStarted = false;
  private narrPos = 0;

  get fullText(): string {
    return this.text;
  }

  push(text: string): ParserEvent[] {
    this.text += text;
    if (this.state === 'abandoned') return [];
    return this.safely(() => this.advance());
  }

  end(): ParserEvent[] {
    if (this.state === 'abandoned') return [];
    return this.safely(() => {
      const events = this.advance();
      if (this.state === 'narrative') {
        // Flush held-back suffix (it can only be a partial marker prefix that never completed).
        const rest = this.text.slice(this.narrPos);
        if (rest.length > 0) {
          events.push({ type: 'narrative', text: rest });
          this.narrPos = this.text.length;
        }
      }
      return events;
    });
  }

  private safely(fn: () => ParserEvent[]): ParserEvent[] {
    try {
      return fn();
    } catch {
      this.state = 'abandoned';
      return [{ type: 'abandoned', reason: 'internal_error' }];
    }
  }

  private abandon(events: ParserEvent[], reason: string): ParserEvent[] {
    this.state = 'abandoned';
    events.push({ type: 'abandoned', reason });
    return events;
  }

  private advance(): ParserEvent[] {
    const events: ParserEvent[] = [];
    for (;;) {
      switch (this.state) {
        case 'seek_fence': {
          const f = this.text.indexOf(FENCE, this.pos);
          const upTo = f >= 0 ? f : this.text.length;
          const nonWs = this.text.slice(0, upTo).replace(/\s/g, '').length;
          if (nonWs > MAX_PREFIX_NONWS) return this.abandon(events, 'no_fence');
          if (f < 0) return events;
          this.pos = f + FENCE.length;
          this.state = 'seek_layout_array';
          continue;
        }
        case 'seek_layout_array': {
          const rest = this.text.slice(this.pos);
          const m = /"layout"\s*:\s*\[/.exec(rest);
          if (m) {
            this.pos += m.index + m[0].length;
            this.state = 'in_items';
            continue;
          }
          if (rest.includes('```') || rest.length > MAX_LAYOUT_KEY_DISTANCE) {
            return this.abandon(events, 'no_layout_array');
          }
          return events;
        }
        case 'in_items': {
          if (this.itemStart < 0) {
            let i = this.pos;
            while (i < this.text.length && /[\s,]/.test(this.text[i])) i++;
            this.pos = i;
            if (i >= this.text.length) return events;
            const c = this.text[i];
            if (c === ']') {
              this.pos = i + 1;
              this.state = 'seek_fence_close';
              continue;
            }
            if (c !== '{') return this.abandon(events, 'unexpected_token');
            this.itemStart = i;
            this.scanI = i;
            this.depth = 0;
            this.inStr = false;
            this.esc = false;
            this.lastHeroKey = '';
          }
          // scan the current item for its closing brace
          let closed = -1;
          for (let j = this.scanI; j < this.text.length; j++) {
            const ch = this.text[j];
            if (this.inStr) {
              if (this.esc) this.esc = false;
              else if (ch === '\\') this.esc = true;
              else if (ch === '"') this.inStr = false;
              continue;
            }
            if (ch === '"') this.inStr = true;
            else if (ch === '{' || ch === '[') this.depth++;
            else if (ch === '}' || ch === ']') {
              this.depth--;
              if (this.depth === 0) {
                closed = j;
                break;
              }
            }
          }
          if (closed < 0) {
            this.scanI = this.text.length;
            if (this.itemIndex === 0) this.emitPartialHero(events);
            return events;
          }
          const raw = this.text.slice(this.itemStart, closed + 1);
          let parsed: unknown;
          try {
            parsed = JSON.parse(raw);
          } catch {
            return this.abandon(events, 'malformed_item');
          }
          const item = parsed as { component?: unknown; props?: unknown };
          if (
            !item ||
            typeof item !== 'object' ||
            typeof item.component !== 'string' ||
            !item.props ||
            typeof item.props !== 'object' ||
            Array.isArray(item.props)
          ) {
            return this.abandon(events, 'unexpected_item_shape');
          }
          const props = item.props as Record<string, unknown>;
          if (this.itemIndex === 0 && item.component === 'HeroBlock') {
            events.push({ type: 'hero_done', props });
          } else {
            events.push({ type: 'component', index: this.itemIndex, component: item.component, props });
          }
          this.itemIndex++;
          this.itemStart = -1;
          this.pos = closed + 1;
          continue;
        }
        case 'seek_fence_close': {
          const f = this.text.indexOf('```', this.pos);
          if (f < 0) return events;
          this.pos = f + 3;
          this.narrPos = this.pos;
          this.state = 'narrative';
          continue;
        }
        case 'narrative': {
          if (!this.narrStarted) {
            let i = this.narrPos;
            while (i < this.text.length && /\s/.test(this.text[i])) i++;
            if (i >= this.text.length) {
              this.narrPos = i;
              return events;
            }
            this.narrPos = i;
            this.narrStarted = true;
          }
          const m = this.text.indexOf(MARKER, this.narrPos);
          if (m >= 0) {
            if (m > this.narrPos) events.push({ type: 'narrative', text: this.text.slice(this.narrPos, m) });
            this.narrPos = this.text.length;
            this.state = 'followups';
            return events;
          }
          let hold = 0;
          const maxHold = Math.min(MARKER.length - 1, this.text.length - this.narrPos);
          for (let k = maxHold; k >= 1; k--) {
            if (this.text.endsWith(MARKER.slice(0, k))) {
              hold = k;
              break;
            }
          }
          const emitEnd = this.text.length - hold;
          if (emitEnd > this.narrPos) {
            events.push({ type: 'narrative', text: this.text.slice(this.narrPos, emitEnd) });
            this.narrPos = emitEnd;
          }
          return events;
        }
        default:
          return events;
      }
    }
  }

  private emitPartialHero(events: ParserEvent[]): void {
    const fields = partialHero(this.text.slice(this.itemStart));
    if (!fields) return;
    const key = JSON.stringify(fields);
    if (key === this.lastHeroKey || key === '{}') return;
    this.lastHeroKey = key;
    events.push({ type: 'hero', ...fields });
  }
}
