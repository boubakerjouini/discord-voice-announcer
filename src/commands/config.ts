import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type TextChannel,
  type MessageReaction,
  type User,
} from "discord.js";
import {
  getConfig,
  updateConfig,
  getAllPanelMessageIds,
  type GuildConfig,
} from "../services/configService.js";
import { logger } from "../utils/logger.js";

interface VoteOption {
  emoji: string;
  label: string;
  value: string | number | boolean;
}

interface VotePanel {
  key: keyof GuildConfig;
  title: string;
  description: string;
  options: VoteOption[];
}

export const VOTE_PANELS: VotePanel[] = [
  {
    key: "language",
    title: "🌍 TTS Language",
    description: "What language should the bot speak?",
    options: [
      { emoji: "🇬🇧", label: "English", value: "en" },
      { emoji: "🇫🇷", label: "French", value: "fr" },
      { emoji: "🇸🇦", label: "Arabic", value: "ar" },
      { emoji: "🇪🇸", label: "Spanish", value: "es" },
      { emoji: "🇩🇪", label: "German", value: "de" },
      { emoji: "🇯🇵", label: "Japanese", value: "ja" },
    ],
  },
  {
    key: "style",
    title: "🎭 Announcement Style",
    description: "How should the bot announce people?",
    options: [
      { emoji: "🎙️", label: "Formal", value: "formal" },
      { emoji: "🎉", label: "Fun", value: "fun" },
      { emoji: "🤖", label: "Robot", value: "robot" },
      { emoji: "⚔️", label: "Medieval", value: "medieval" },
      { emoji: "🏴‍☠️", label: "Pirate", value: "pirate" },
    ],
  },
  {
    key: "leaveThreshold",
    title: "🚪 Leave Announcement Threshold",
    description: "Minimum users in channel before leave announcements play",
    options: [
      { emoji: "2️⃣", label: "2 users", value: 2 },
      { emoji: "3️⃣", label: "3 users", value: 3 },
      { emoji: "5️⃣", label: "5 users", value: 5 },
      { emoji: "🔟", label: "10 users", value: 10 },
    ],
  },
  {
    key: "announceSwitches",
    title: "🔀 Announce Channel Switches",
    description: "Announce when someone switches between voice channels?",
    options: [
      { emoji: "✅", label: "Yes", value: true },
      { emoji: "❌", label: "No", value: false },
    ],
  },
  {
    key: "slowTts",
    title: "🐌 TTS Speed",
    description: "How fast should the bot speak?",
    options: [
      { emoji: "🐇", label: "Normal speed", value: false },
      { emoji: "🐌", label: "Slow and dramatic", value: true },
    ],
  },
];

export const configCommand = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Configure the voice announcer bot")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("setup")
      .setDescription("Post config vote panels (once per channel)")
  )
  .addSubcommand((sub) =>
    sub.setName("status").setDescription("Show current bot configuration")
  )
  .addSubcommand((sub) =>
    sub
      .setName("reset")
      .setDescription("Delete existing panels and post fresh ones")
  );

export async function handleConfigCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "status") {
    await showStatus(interaction);
  } else if (subcommand === "setup") {
    await setupPanels(interaction, false);
  } else if (subcommand === "reset") {
    await setupPanels(interaction, true);
  }
}

// --- /config status ---

async function showStatus(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guildConfig = getConfig(interaction.guildId!);

  const langLabel =
    VOTE_PANELS[0]!.options.find((o) => o.value === guildConfig.language)
      ?.label ?? guildConfig.language;
  const styleLabel =
    VOTE_PANELS[1]!.options.find((o) => o.value === guildConfig.style)?.label ??
    guildConfig.style;

  const embed = new EmbedBuilder()
    .setTitle("⚙️ Current Configuration")
    .setColor(0x5865f2)
    .addFields(
      { name: "🌍 Language", value: langLabel, inline: true },
      { name: "🎭 Style", value: styleLabel, inline: true },
      {
        name: "🚪 Leave Threshold",
        value: `${guildConfig.leaveThreshold} users`,
        inline: true,
      },
      {
        name: "🔀 Announce Switches",
        value: guildConfig.announceSwitches ? "Yes" : "No",
        inline: true,
      },
      {
        name: "🐌 TTS Speed",
        value: guildConfig.slowTts ? "Slow" : "Normal",
        inline: true,
      }
    )
    .setFooter({ text: "React on the config panels to vote!" });

  await interaction.reply({ embeds: [embed] });
}

// --- /config setup ---

async function setupPanels(
  interaction: ChatInputCommandInteraction,
  forceReset: boolean
): Promise<void> {
  const guildId = interaction.guildId!;
  const guildConfig = getConfig(guildId);
  const channel = interaction.channel as TextChannel;

  if (!channel || !("send" in channel)) {
    await interaction.reply({
      content: "This command must be used in a text channel.",
      ephemeral: true,
    });
    return;
  }

  // Check if panels already exist
  if (!forceReset && guildConfig.panelMessageIds && guildConfig.configChannelId) {
    const panelsExist = await verifyPanelsExist(
      channel.client,
      guildConfig.configChannelId,
      guildConfig.panelMessageIds
    );

    if (panelsExist) {
      await interaction.reply({
        content:
          "⚙️ Config panels already exist in <#" +
          guildConfig.configChannelId +
          ">! React to vote. Use `/config reset` to recreate them.",
        ephemeral: true,
      });
      return;
    }
  }

  // Delete old panels if they exist
  if (guildConfig.panelMessageIds && guildConfig.configChannelId) {
    await deleteOldPanels(
      channel.client,
      guildConfig.configChannelId,
      guildConfig.panelMessageIds
    );
  }

  await interaction.reply({
    content:
      "🗳️ **Config panels posted!** React to vote — changes apply instantly.",
  });

  const panelMessageIds: Record<string, string> = {};

  for (const panel of VOTE_PANELS) {
    const currentValue = guildConfig[panel.key];

    const optionLines = panel.options
      .map(
        (o) =>
          `${o.emoji}  ${o.label}${o.value === currentValue ? "  ◀ active" : ""}`
      )
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle(panel.title)
      .setDescription(
        `${panel.description}\n\n${optionLines}\n\n*React to vote — most votes wins instantly!*`
      )
      .setColor(0x5865f2);

    const message = await channel.send({ embeds: [embed] });

    // Pre-react so users see the emojis
    for (const option of panel.options) {
      await message.react(option.emoji);
    }

    panelMessageIds[panel.key] = message.id;
  }

  // Save panel message IDs
  updateConfig(guildId, {
    configChannelId: channel.id,
    panelMessageIds,
  });

  logger.info(`Config panels posted in guild ${guildId}, channel ${channel.id}`);
}

async function verifyPanelsExist(
  client: { channels: { fetch: (id: string) => Promise<unknown> } },
  channelId: string,
  panelMessageIds: Record<string, string>
): Promise<boolean> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || typeof channel !== "object" || !("messages" in channel)) return false;

    const textChannel = channel as TextChannel;
    for (const messageId of Object.values(panelMessageIds)) {
      try {
        await textChannel.messages.fetch(messageId);
      } catch {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function deleteOldPanels(
  client: { channels: { fetch: (id: string) => Promise<unknown> } },
  channelId: string,
  panelMessageIds: Record<string, string>
): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || typeof channel !== "object" || !("messages" in channel)) return;

    const textChannel = channel as TextChannel;
    for (const messageId of Object.values(panelMessageIds)) {
      try {
        const msg = await textChannel.messages.fetch(messageId);
        await msg.delete();
      } catch {
        // Message already gone
      }
    }
  } catch {
    // Channel gone
  }
}

// --- Reaction handler (called from index.ts) ---

export async function handleReactionUpdate(
  reaction: MessageReaction,
  user: User
): Promise<void> {
  if (user.bot) return;

  const messageId = reaction.message.id;
  const panelMap = getAllPanelMessageIds();
  const tracked = panelMap.get(messageId);

  if (!tracked) return;

  const { guildId, key } = tracked;
  const panel = VOTE_PANELS.find((p) => p.key === key);
  if (!panel) return;

  // Fetch the full message to get accurate reaction counts
  const message = reaction.message.partial
    ? await reaction.message.fetch()
    : reaction.message;

  // Tally: find the emoji with the most votes (minus bot's own reaction)
  let bestOption = panel.options[0]!;
  let bestCount = 0;

  for (const option of panel.options) {
    const r = message.reactions.cache.find(
      (rx) => rx.emoji.name === option.emoji || rx.emoji.toString() === option.emoji
    );
    const count = r ? r.count - 1 : 0; // -1 for bot's pre-reaction
    if (count > bestCount) {
      bestCount = count;
      bestOption = option;
    }
  }

  const currentConfig = getConfig(guildId);
  const currentValue = currentConfig[key as keyof GuildConfig];

  // Only update if the winner changed
  if (bestOption.value !== currentValue) {
    updateConfig(guildId, { [key]: bestOption.value });

    // Update the embed to show new active option
    const optionLines = panel.options
      .map(
        (o) =>
          `${o.emoji}  ${o.label}${o.value === bestOption.value ? "  ◀ active" : ""}`
      )
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle(panel.title)
      .setDescription(
        `${panel.description}\n\n${optionLines}\n\n*React to vote — most votes wins instantly!*`
      )
      .setColor(0x57f287);

    await message.edit({ embeds: [embed] });

    logger.info(
      `[${guildId}] Config "${key}" changed to "${bestOption.value}" (${bestCount} votes)`
    );
  }
}
