import type { VoiceBasedChannel, VoiceState } from "discord.js";
import { generateTTSBuffer } from "../services/ttsService.js";
import { playAnnouncement, leaveChannel } from "../services/voiceService.js";
import { logger } from "../utils/logger.js";

function hasHumanMembers(channel: VoiceBasedChannel): boolean {
  return channel.members.some((m) => !m.user.bot);
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

      const text = `${displayName} has left the channel`;
      logger.info(`[${oldState.guild.name}] ${text}`);
      const buffer = await generateTTSBuffer(text);
      await playAnnouncement(oldState.channel, buffer);
      return;
    }

    // User switched channels
    if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      // Announce leave in old channel (if humans remain)
      if (oldState.channel && hasHumanMembers(oldState.channel)) {
        const leaveText = `${displayName} has left the channel`;
        logger.info(`[${oldState.guild.name}] ${leaveText} (switched)`);
        const leaveBuffer = await generateTTSBuffer(leaveText);
        await playAnnouncement(oldState.channel, leaveBuffer);
      } else if (oldState.channel) {
        leaveChannel(oldState.guild.id);
      }

      // Announce join in new channel
      if (newState.channel) {
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
