import * as Sentry from '@sentry/nextjs';

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,

  beforeSend(event, hint) {
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }

    const error = hint.originalException;
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as Error).message;
      if (
        message.includes('Network request failed') ||
        message.includes('cancelled') ||
        message.includes('aborted') ||
        message.includes('Load failed')
      ) {
        return null;
      }
    }

    return event;
  },
});
