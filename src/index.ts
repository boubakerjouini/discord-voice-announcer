import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  type Interaction,
} from "discord.js";
import { config } from "./config.js";
import { handleReady } from "./events/ready.js";
import { handleVoiceStateUpdate } from "./events/voiceStateUpdate.js";
import {
  configCommand,
  handleConfigCommand,
  handleReactionUpdate,
} from "./commands/config.js";
import { destroyAll } from "./services/voiceService.js";
import { logger } from "./utils/logger.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction],
});

// Register slash commands per guild (instant update, no 1h cache)
async function registerCommands(client: Client<true>): Promise<void> {
  const rest = new REST().setToken(config.token);
  const body = [configCommand.toJSON()];
  try {
    // Register per guild for instant availability
    for (const [guildId] of client.guilds.cache) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guildId),
        { body }
      );
    }
    // Also clear stale global commands
    await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
    logger.info(`Slash commands registered in ${client.guilds.cache.size} guild(s)`);
  } catch (error) {
    logger.error("Failed to register slash commands", error);
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  handleReady(readyClient);
  await registerCommands(readyClient);
});

client.on(Events.VoiceStateUpdate, handleVoiceStateUpdate);

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "config") {
    try {
      await handleConfigCommand(interaction);
    } catch (error) {
      logger.error("Error handling config command", error);
      const reply =
        interaction.replied || interaction.deferred
          ? interaction.followUp.bind(interaction)
          : interaction.reply.bind(interaction);
      await reply({ content: "Something went wrong!", ephemeral: true });
    }
  }
});

// Auto-apply config when someone reacts on a config panel
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try {
    if (reaction.partial) await reaction.fetch();
    if (user.partial) await user.fetch();
    await handleReactionUpdate(reaction as any, user as any);
  } catch (error) {
    logger.error("Error handling reaction add", error);
  }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  try {
    if (reaction.partial) await reaction.fetch();
    if (user.partial) await user.fetch();
    await handleReactionUpdate(reaction as any, user as any);
  } catch (error) {
    logger.error("Error handling reaction remove", error);
  }
});

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
