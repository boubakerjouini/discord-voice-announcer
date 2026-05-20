import { Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { handleReady } from "./events/ready.js";
import { handleVoiceStateUpdate } from "./events/voiceStateUpdate.js";
import { destroyAll } from "./services/voiceService.js";
import { logger } from "./utils/logger.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.once(Events.ClientReady, handleReady);
client.on(Events.VoiceStateUpdate, handleVoiceStateUpdate);

function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down...`);
  destroyAll();
  client.destroy();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (error) => {
  logger.error("Unhandled promise rejection", error);
});

client.login(config.token).catch((error) => {
  logger.error("Failed to login", error);
  process.exit(1);
});
