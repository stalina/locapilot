/**
 * Structured logging utility.
 *
 * Provides leveled, structured log entries with a timestamp, optional context
 * and a serialized error. Entries are emitted to the console (with the matching
 * console method) and kept in a bounded in-memory ring buffer so they can be
 * inspected or exported (e.g. for support / diagnostics) — there is no backend
 * to ship logs to in this offline-first PWA.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: SerializedError;
}

/** Maximum number of entries kept in memory before the oldest are dropped. */
const MAX_BUFFER_SIZE = 200;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const buffer: LogEntry[] = [];

// In production we keep the console quiet for non-errors; in dev we surface everything.
const minLevel: LogLevel = import.meta.env.DEV ? 'debug' : 'warn';

function serializeError(error: unknown): SerializedError | undefined {
  if (error === undefined || error === null) {
    return undefined;
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'NonError', message: String(error) };
}

function emitToConsole(entry: LogEntry): void {
  const prefix = `[${entry.timestamp}] ${entry.level.toUpperCase()}`;
  const args: unknown[] = [`${prefix} ${entry.message}`];
  if (entry.context) {
    args.push(entry.context);
  }
  if (entry.error) {
    args.push(entry.error);
  }

  switch (entry.level) {
    case 'error':
      console.error(...args);
      break;
    case 'warn':
      console.warn(...args);
      break;
    case 'info':
      console.info(...args);
      break;
    default:
      console.debug(...args);
  }
}

function record(level: LogLevel, message: string, context?: LogContext, error?: unknown): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
    ...(serializeError(error) ? { error: serializeError(error) } : {}),
  };

  buffer.push(entry);
  if (buffer.length > MAX_BUFFER_SIZE) {
    buffer.shift();
  }

  if (LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel]) {
    emitToConsole(entry);
  }

  return entry;
}

export const logger = {
  debug(message: string, context?: LogContext): LogEntry {
    return record('debug', message, context);
  },
  info(message: string, context?: LogContext): LogEntry {
    return record('info', message, context);
  },
  warn(message: string, context?: LogContext, error?: unknown): LogEntry {
    return record('warn', message, context, error);
  },
  error(message: string, context?: LogContext, error?: unknown): LogEntry {
    return record('error', message, context, error);
  },
  /** Returns a copy of the in-memory log buffer (oldest first). */
  getEntries(): LogEntry[] {
    return [...buffer];
  },
  /** Clears the in-memory log buffer. */
  clear(): void {
    buffer.length = 0;
  },
};
