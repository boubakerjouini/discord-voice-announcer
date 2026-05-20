import "dotenv/config";

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level && LOG_LEVELS.includes(level as LogLevel)) {
    return level as LogLevel;
  }
  return "info";
}

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  throw new Error(
    "DISCORD_BOT_TOKEN is required. Copy .env.example to .env and set your bot token."
  );
}

export const config = Object.freeze({
  token,
  ttsLang: process.env.TTS_LANG ?? "en",
  logLevel: getLogLevel(),
});
