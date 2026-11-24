/**
 * Provider health check (PERF-03, D-515..D-517).
 *
 * One function reports the model route, model ids, key validity and remaining
 * credit. Used by the admin /api/health route, the non-blocking startup check
 * and the eval preflight. Report-only: it never throws and never blocks chat.
 * No Next imports, so the eval harness can import it.
 */

import { CONCIERGE_CONFIG } from './concierge-config';
import { embeddingConfig, generationModelId, providerRoute, type ProviderRoute } from './llm-config';

export type HealthStatus = 'ok' | 'warn' | 'fail';

export interface ProviderHealth {
  status: HealthStatus;
  reason: string;
  checkedAt: string;
  route: ProviderRoute;
  models: { generation: string; embedding: string };
  key: { present: boolean; valid: boolean | null };
  credit: { limit: number | null; remaining: number | null; usage: number | null };
  httpStatus: number | null;
}

const KEY_URL = 'https://openrouter.ai/api/v1/key';
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const usd = (n: number) => `$${n.toFixed(2)}`;

export async function checkProviderHealth(
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch; warnBelowUsd?: number } = {},
): Promise<ProviderHealth> {
  const timeoutMs = opts.timeoutMs ?? CONCIERGE_CONFIG.health.requestTimeoutMs;
  const warnBelow = opts.warnBelowUsd ?? CONCIERGE_CONFIG.health.warnBelowUsd;
  const doFetch = opts.fetchImpl ?? fetch;
  const route = providerRoute();
  const key = process.env.OPENROUTER_API_KEY;

  const out: ProviderHealth = {
    status: 'ok',
    reason: '',
    checkedAt: new Date().toISOString(),
    route,
    models: { generation: generationModelId(), embedding: embeddingConfig().model },
    key: { present: Boolean(key), valid: null },
    credit: { limit: null, remaining: null, usage: null },
    httpStatus: null,
  };
  const done = (status: HealthStatus, reason: string): ProviderHealth => ({ ...out, status, reason });

  try {
    if (route !== 'openrouter') {
      return done('fail', 'Model calls are on the direct route, not OpenRouter; set OPENROUTER_API_KEY');
    }
    if (!key) return done('fail', 'OPENROUTER_API_KEY is not set');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      // Next 14 caches GET fetches in its data cache even on force-dynamic routes; no-store keeps credit live (PERF-03).
      res = await doFetch(KEY_URL, { headers: { Authorization: `Bearer ${key}` }, signal: controller.signal, cache: 'no-store' });
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      return done(
        'warn',
        aborted
          ? `OpenRouter key check timed out after ${timeoutMs} ms`
          : `Could not reach OpenRouter: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    out.httpStatus = res.status;
    if (res.status === 401 || res.status === 403) {
      out.key.valid = false;
      return done('fail', `OpenRouter key is invalid (HTTP ${res.status})`);
    }
    if (!res.ok) return done('warn', `OpenRouter key check returned HTTP ${res.status}`);

    out.key.valid = true;
    const body = (await res.json().catch(() => ({}))) as {
      data?: { limit?: unknown; limit_remaining?: unknown; usage?: unknown; effective_budget?: { remaining_usd?: unknown } };
    };
    const d = body.data ?? {};
    out.credit.limit = num(d.limit);
    out.credit.usage = num(d.usage);
    const candidates = [num(d.limit_remaining), num(d.effective_budget?.remaining_usd)].filter((n): n is number => n !== null);
    if (candidates.length === 0) {
      return done('warn', 'credit unknown: key has no limit; the account balance needs a management key');
    }
    const remaining = Math.min(...candidates);
    out.credit.remaining = remaining;
    if (remaining <= 0) return done('fail', `OpenRouter credit is used up (${usd(remaining)} left)`);
    if (remaining < warnBelow) return done('warn', `OpenRouter credit ${usd(remaining)} is below ${usd(warnBelow)}`);
    return done('ok', `OpenRouter route, key valid, ${usd(remaining)} credit left`);
  } catch (e) {
    return done('warn', `Provider health check failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Fire-and-forget startup check; returns immediately and never delays serving (D-517). */
export function runStartupHealthCheck(): void {
  void checkProviderHealth({ timeoutMs: CONCIERGE_CONFIG.health.startupTimeoutMs })
    .then(h =>
      h.status === 'ok'
        ? console.info(`[provider-health] ok: ${h.reason}`)
        : console.warn(`[provider-health] ${h.status.toUpperCase()}: ${h.reason} (route ${h.route}, model ${h.models.generation})`),
    )
    .catch(() => {});
}
