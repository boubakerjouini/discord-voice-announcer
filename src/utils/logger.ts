import { config } from "../config.js";

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
const currentLevel = LEVELS[config.logLevel];

function format(level: string, message: string): string {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  debug(message: string, ...args: unknown[]) {
    if (currentLevel <= LEVELS.debug) {
      console.log(format("debug", message), ...args);
    }
  },
  info(message: string, ...args: unknown[]) {
    if (currentLevel <= LEVELS.info) {
      console.log(format("info", message), ...args);
    }
  },
  warn(message: string, ...args: unknown[]) {
    if (currentLevel <= LEVELS.warn) {
      console.warn(format("warn", message), ...args);
    }
  },
  error(message: string, ...args: unknown[]) {
    if (currentLevel <= LEVELS.error) {
      console.error(format("error", message), ...args);
    }
  },
};
