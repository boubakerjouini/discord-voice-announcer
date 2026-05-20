import { ActivityType, type Client } from "discord.js";
import { logger } from "../utils/logger.js";

export function handleReady(client: Client<true>): void {
  logger.info(
    `Bot is online as ${client.user.tag}, serving ${client.guilds.cache.size} guild(s)`
  );
  client.user.setActivity("voice channels", { type: ActivityType.Watching });
}
