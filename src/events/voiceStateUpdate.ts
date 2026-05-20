import type { VoiceBasedChannel, VoiceState } from "discord.js";
import { generateTTSBuffer } from "../services/ttsService.js";
import { playAnnouncement, leaveChannel } from "../services/voiceService.js";
import { getConfig } from "../services/configService.js";
import { getJoinMessage, getLeaveMessage } from "../services/messageService.js";
import { logger } from "../utils/logger.js";

function hasHumanMembers(channel: VoiceBasedChannel): boolean {
  return channel.members.some((m) => !m.user.bot);
}

function countHumanMembers(channel: VoiceBasedChannel): number {
  return channel.members.filter((m) => !m.user.bot).size;
}

export async function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  try {
    if (newState.member?.user.bot) return;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (oldChannelId === newChannelId) return;

    const guildId = newState.guild.id;
    const guildConfig = getConfig(guildId);
    const displayName = newState.member?.displayName ?? "Someone";

    // User joined a channel
    if (!oldChannelId && newChannelId && newState.channel) {
      if (countHumanMembers(newState.channel) <= 1) {
        logger.debug(`[${newState.guild.name}] ${displayName} joined solo — skipping`);
        return;
      }
      const text = getJoinMessage(displayName, guildConfig.style);
      logger.info(`[${newState.guild.name}] ${text}`);
      const buffer = await generateTTSBuffer(text, guildConfig.language, guildConfig.slowTts);
      await playAnnouncement(newState.channel, buffer);
      return;
    }

    // User left a channel
    if (oldChannelId && !newChannelId && oldState.channel) {
      if (!hasHumanMembers(oldState.channel)) {
        logger.info(`[${oldState.guild.name}] ${displayName} left, channel empty — leaving`);
        leaveChannel(oldState.guild.id);
        return;
      }

      if (countHumanMembers(oldState.channel) >= guildConfig.leaveThreshold) {
        const text = getLeaveMessage(displayName, guildConfig.style);
        logger.info(`[${oldState.guild.name}] ${text}`);
        const buffer = await generateTTSBuffer(text, guildConfig.language, guildConfig.slowTts);
        await playAnnouncement(oldState.channel, buffer);
      } else {
        logger.debug(`[${oldState.guild.name}] ${displayName} left, <${guildConfig.leaveThreshold} users — skipping`);
      }
      return;
    }

    // User switched channels
    if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      if (!guildConfig.announceSwitches) {
        logger.debug(`[${newState.guild.name}] ${displayName} switched channels — switches disabled`);
        // Still clean up empty channels
        if (oldState.channel && !hasHumanMembers(oldState.channel)) {
          leaveChannel(oldState.guild.id);
        }
        return;
      }

      // Announce leave in old channel (only if threshold met)
      if (oldState.channel && countHumanMembers(oldState.channel) >= guildConfig.leaveThreshold) {
        const leaveText = getLeaveMessage(displayName, guildConfig.style);
        logger.info(`[${oldState.guild.name}] ${leaveText} (switched)`);
        const leaveBuffer = await generateTTSBuffer(leaveText, guildConfig.language, guildConfig.slowTts);
        await playAnnouncement(oldState.channel, leaveBuffer);
      } else if (oldState.channel && !hasHumanMembers(oldState.channel)) {
        leaveChannel(oldState.guild.id);
      }

      // Announce join in new channel (skip if solo)
      if (newState.channel && countHumanMembers(newState.channel) > 1) {
        const joinText = getJoinMessage(displayName, guildConfig.style);
        logger.info(`[${newState.guild.name}] ${joinText} (switched)`);
        const joinBuffer = await generateTTSBuffer(joinText, guildConfig.language, guildConfig.slowTts);
        await playAnnouncement(newState.channel, joinBuffer);
      }
    }
  } catch (error) {
    logger.error("Error handling voice state update", error);
  }
}
