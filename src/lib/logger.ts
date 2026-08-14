type Level = "debug" | "info" | "warn" | "error";

const severity: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

/**
 * Structured server logging, filtered by LOG_LEVEL.
 *
 * Every record carries a timestamp, the environment, a severity, and a message,
 * per OBSERVABILITY.md. Correlation id, actor, entity, and duration are passed
 * as context by the caller that knows them.
 *
 * Records here are operational, not forensic: they carry references, ids, and
 * outcomes, never customer names, addresses, emails, phone numbers, or
 * credentials. A log line that would be awkward in a support ticket does not
 * belong in it.
 */
function write(level: Level, message: string, context: Record<string, unknown> = {}) {
  const configured = readConfiguredLevel();

  if (severity[level] < severity[configured]) {
    return;
  }

  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    level,
    message,
    ...context
  });

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

/**
 * Reads LOG_LEVEL on its own rather than through the full server env schema.
 * Validating everything here would make logging fail wherever configuration is
 * partial — tests, scripts, early boot — and silently fall back to a level
 * nobody chose.
 */
function readConfiguredLevel(): Level {
  const configured = process.env.LOG_LEVEL;

  return configured && configured in severity ? (configured as Level) : "info";
}

/** Reduces an unknown thrown value to something safe to record. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unknown error";
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", message, context)
};
