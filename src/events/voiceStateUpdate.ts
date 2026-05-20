import type { VoiceBasedChannel, VoiceState } from "discord.js";
import { generateTTSBuffer } from "../services/ttsService.js";
import { playAnnouncement, leaveChannel } from "../services/voiceService.js";
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
    // Ignore bots
    if (newState.member?.user.bot) return;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    // Ignore non-channel-change events (mute, deaf, etc.)
    if (oldChannelId === newChannelId) return;

    const displayName = newState.member?.displayName ?? "Someone";

    // User joined a channel
    if (!oldChannelId && newChannelId && newState.channel) {
      // Don't announce if the user is alone (no audience)
      if (countHumanMembers(newState.channel) <= 1) {
        logger.debug(`[${newState.guild.name}] ${displayName} joined solo — skipping`);
        return;
      }
      const text = `${displayName} has joined the channel`;
      logger.info(`[${newState.guild.name}] ${text}`);
      const buffer = await generateTTSBuffer(text);
      await playAnnouncement(newState.channel, buffer);
      return;
    }

    // User left a channel
    if (oldChannelId && !newChannelId && oldState.channel) {
      if (!hasHumanMembers(oldState.channel)) {
        logger.info(
          `[${oldState.guild.name}] ${displayName} left, channel empty — leaving`
        );
        leaveChannel(oldState.guild.id);
        return;
      }

      // Only announce leaves when 5+ humans remain
      if (countHumanMembers(oldState.channel) >= 5) {
        const text = `${displayName} has left the channel`;
        logger.info(`[${oldState.guild.name}] ${text}`);
        const buffer = await generateTTSBuffer(text);
        await playAnnouncement(oldState.channel, buffer);
      } else {
        logger.debug(`[${oldState.guild.name}] ${displayName} left, <5 users — skipping`);
      }
      return;
    }

    // User switched channels
    if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      // Announce leave in old channel (only if 5+ humans remain)
      if (oldState.channel && countHumanMembers(oldState.channel) >= 5) {
        const leaveText = `${displayName} has left the channel`;
        logger.info(`[${oldState.guild.name}] ${leaveText} (switched)`);
        const leaveBuffer = await generateTTSBuffer(leaveText);
        await playAnnouncement(oldState.channel, leaveBuffer);
      } else if (oldState.channel && !hasHumanMembers(oldState.channel)) {
        leaveChannel(oldState.guild.id);
      }

      // Announce join in new channel (skip if solo)
      if (newState.channel && countHumanMembers(newState.channel) > 1) {
        const joinText = `${displayName} has joined the channel`;
        logger.info(`[${newState.guild.name}] ${joinText} (switched)`);
        const joinBuffer = await generateTTSBuffer(joinText);
        await playAnnouncement(newState.channel, joinBuffer);
      }
    }
  } catch (error) {
    logger.error("Error handling voice state update", error);
  }
}
