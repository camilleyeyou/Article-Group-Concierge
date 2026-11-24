/**
 * Tiny per-request mark recorder for the teaser critical path (PERF-01 measurement).
 * No-op when disabled, so it costs nothing in normal requests.
 */
export interface PerfMarks {
  mark(name: string, value?: number): void;
  snapshot(): Record<string, number>;
}

export function createPerfMarks(enabled: boolean): PerfMarks {
  if (!enabled) return { mark() {}, snapshot: () => ({}) };
  const t0 = performance.now();
  const marks: Record<string, number> = {};
  return {
    mark(name, value) {
      marks[name] = value ?? Math.round((performance.now() - t0) * 10) / 10;
    },
    snapshot: () => ({ ...marks }),
  };
}
