import './lib';
/**
 * Preflight checks run before any paid eval work.
 *
 * Confirms Supabase is reachable (the free tier pauses after inactivity), the
 * OpenRouter key is set and has enough remaining credit, and optionally that
 * the dev server is up. Stops with a clear message instead of recording errors.
 *
 * Usage: npm run eval:preflight
 */

import * as dns from 'dns';

export interface PreflightOptions {
  supabase?: boolean;
  openrouter?: boolean;
  devServer?: string | null;
  minCreditUsd?: number;
}

export interface PreflightResult {
  creditRemainingUsd: number | null;
  creditUsageUsd: number | null;
}

export class PreflightError extends Error {}

const TIMEOUT_MS = 10_000;

async function timedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const errText = (e: unknown) => (e instanceof Error ? (e.name === 'AbortError' ? 'timed out after 10s' : e.message) : String(e));

async function checkSupabase(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new PreflightError('NEXT_PUBLIC_SUPABASE_URL is not set');
  const hostname = new URL(url).hostname;
  const unreachable = (detail: string) =>
    new PreflightError(
      `Supabase project ${hostname} is unreachable or paused (${detail}). Restore it in the Supabase dashboard (human action), wait until it is healthy, then rerun. No eval calls were made.`,
    );

  try {
    await dns.promises.lookup(hostname);
  } catch (e) {
    throw unreachable(`DNS: ${errText(e)}`);
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  try {
    const res = await timedFetch(`${url.replace(/\/$/, '')}/rest/v1/documents?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw unreachable(`HTTP ${res.status}`);
  } catch (e) {
    if (e instanceof PreflightError) throw e;
    throw unreachable(errText(e));
  }
  console.log(`preflight: supabase ok (${hostname})`);
}

async function checkOpenRouter(minCreditUsd: number): Promise<PreflightResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new PreflightError('OPENROUTER_API_KEY is not set: the eval must use the same OpenRouter route as production.');
  }
  let res: Response;
  try {
    res = await timedFetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${key}` } });
  } catch (e) {
    throw new PreflightError(`Could not reach OpenRouter to check credit (${errText(e)}).`);
  }
  if (!res.ok) throw new PreflightError(`OpenRouter key check failed with HTTP ${res.status}.`);

  const body = (await res.json()) as { data?: { limit?: number | null; limit_remaining?: number | null; usage?: number | null } };
  const remaining = typeof body.data?.limit_remaining === 'number' ? body.data.limit_remaining : null;
  const limit = typeof body.data?.limit === 'number' ? body.data.limit : null;
  const usage = typeof body.data?.usage === 'number' ? body.data.usage : null;

  if (remaining !== null && remaining < minCreditUsd) {
    throw new PreflightError(
      `OpenRouter key has $${remaining.toFixed(2)} left; this step needs about $${minCreditUsd.toFixed(2)}. Top up or lower the scope.`,
    );
  }
  console.log(
    remaining === null
      ? 'preflight: openrouter ok, no credit limit on key'
      : `preflight: openrouter ok, $${remaining.toFixed(2)} of $${(limit ?? remaining).toFixed(2)} left`,
  );
  return { creditRemainingUsd: remaining, creditUsageUsd: usage };
}

async function checkDevServer(base: string): Promise<void> {
  try {
    await timedFetch(`${base.replace(/\/$/, '')}/api/chat`);
  } catch {
    throw new PreflightError(`Cannot reach ${base}. Start the dev server with \`npm run dev\` (EVAL_DEBUG=true in .env.local).`);
  }
  console.log(`preflight: dev server ok (${base})`);
}

export async function runPreflight(opts: PreflightOptions = {}): Promise<PreflightResult> {
  const { supabase = true, openrouter = true, devServer = null, minCreditUsd = Number(process.env.EVAL_MIN_CREDIT_USD || 4) } = opts;
  let result: PreflightResult = { creditRemainingUsd: null, creditUsageUsd: null };
  if (supabase) await checkSupabase();
  if (openrouter) result = await checkOpenRouter(minCreditUsd);
  if (devServer) await checkDevServer(devServer);
  return result;
}

if (require.main === module) {
  const base = (process.env.EVAL_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  runPreflight({ supabase: true, openrouter: true, devServer: base })
    .then(() => console.log('preflight: all checks passed'))
    .catch(error => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(error instanceof PreflightError ? 2 : 1);
    });
}
