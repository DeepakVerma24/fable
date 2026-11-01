import { pino, type Logger } from 'pino';

export function createLogger(service: string): Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service, simulated: true },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    redact: ['req.headers.authorization', 'req.headers.cookie', 'dsn'],
  });
}
