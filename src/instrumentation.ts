export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');

    // Report-only and never awaited beyond the import: must not delay serving (D-517).
    const { runStartupHealthCheck } = await import('./lib/provider-health');
    runStartupHealthCheck();
    void import('./lib/catalogue').then(m => m.getCatalogue()).catch(() => {});
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
