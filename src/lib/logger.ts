/**
 * Environment-Aware Logger
 *
 * Provides structured logging with automatic production silencing.
 * In production, only errors are logged to reduce noise.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

interface LoggerConfig {
  minLevel: LogLevel;
  enableInProduction: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LoggerConfig;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.config = {
      minLevel: this.isDevelopment ? 'debug' : 'error',
      enableInProduction: false,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, only log errors unless explicitly enabled
    if (!this.isDevelopment && !this.config.enableInProduction) {
      return level === 'error';
    }

    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (context && Object.keys(context).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(context)}`;
    }

    return `${prefix} ${message}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorContext = {
        ...context,
        ...(error instanceof Error && {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }),
      };
      console.error(this.formatMessage('error', message, errorContext));
    }
  }

  // Scoped logger for specific modules
  scope(scopeName: string) {
    return {
      debug: (message: string, context?: LogContext) =>
        this.debug(`[${scopeName}] ${message}`, context),
      info: (message: string, context?: LogContext) =>
        this.info(`[${scopeName}] ${message}`, context),
      warn: (message: string, context?: LogContext) =>
        this.warn(`[${scopeName}] ${message}`, context),
      error: (message: string, error?: Error | unknown, context?: LogContext) =>
        this.error(`[${scopeName}] ${message}`, error, context),
    };
  }

  // Performance timing helper
  time(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug(`Timer: ${label}`, { duration_ms: duration });
    };
  }
}

// Export singleton instance
export const logger = new Logger();

// Convenience exports for common use cases
export const RAGLogger = logger.scope('RAG');
export const APILogger = logger.scope('API');
export const OrchLogger = logger.scope('Orchestrator');
export const UILogger = logger.scope('UI');
