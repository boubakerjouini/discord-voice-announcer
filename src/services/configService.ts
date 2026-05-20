import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../utils/logger.js";

export type AnnouncementStyle =
  | "formal"
  | "fun"
  | "robot"
  | "medieval"
  | "pirate";

export interface GuildConfig {
  language: string;
  style: AnnouncementStyle;
  leaveThreshold: number;
  announceSwitches: boolean;
  slowTts: boolean;
  configChannelId?: string;
  panelMessageIds?: Record<string, string>;
}

const DEFAULT_CONFIG: GuildConfig = {
  language: "en",
  style: "formal",
  leaveThreshold: 5,
  announceSwitches: true,
  slowTts: false,
};

const DATA_DIR = join(process.cwd(), "data");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function configPath(guildId: string): string {
  return join(DATA_DIR, `${guildId}.json`);
}

const configCache = new Map<string, GuildConfig>();

export function getConfig(guildId: string): GuildConfig {
  const cached = configCache.get(guildId);
  if (cached) return cached;

  ensureDataDir();
  const path = configPath(guildId);

  if (existsSync(path)) {
    try {
      const data = JSON.parse(readFileSync(path, "utf-8"));
      const config = { ...DEFAULT_CONFIG, ...data };
      configCache.set(guildId, config);
      return config;
    } catch {
      logger.warn(`Failed to read config for guild ${guildId}, using defaults`);
    }
  }

  configCache.set(guildId, { ...DEFAULT_CONFIG });
  return { ...DEFAULT_CONFIG };
}

export function updateConfig(
  guildId: string,
  updates: Partial<GuildConfig>
): GuildConfig {
  const current = getConfig(guildId);
  const updated = { ...current, ...updates };

  ensureDataDir();
  writeFileSync(configPath(guildId), JSON.stringify(updated, null, 2));
  configCache.set(guildId, updated);

  logger.info(`Config updated for guild ${guildId}: ${JSON.stringify(updates)}`);
  return updated;
}

/** Returns a map of messageId -> configKey for all guilds (for reaction tracking) */
export function getAllPanelMessageIds(): Map<string, { guildId: string; key: string }> {
  const map = new Map<string, { guildId: string; key: string }>();

  ensureDataDir();
  const dataDir = DATA_DIR;
  if (!existsSync(dataDir)) return map;

  for (const file of readdirSync(dataDir)) {
    if (!file.endsWith(".json")) continue;
    const guildId = file.replace(".json", "");
    const config = getConfig(guildId);
    if (config.panelMessageIds) {
      for (const [key, messageId] of Object.entries(config.panelMessageIds)) {
        map.set(messageId, { guildId, key });
      }
    }
  }
  return map;
}

export { DEFAULT_CONFIG };
