import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
  type VoiceConnection,
  type AudioPlayer,
} from "@discordjs/voice";
import type { VoiceBasedChannel } from "discord.js";
import { Readable } from "node:stream";
import { logger } from "../utils/logger.js";

interface QueueItem {
  buffer: Buffer;
  resolve: () => void;
}

interface GuildVoiceState {
  connection: VoiceConnection;
  player: AudioPlayer;
  queue: QueueItem[];
  isPlaying: boolean;
  leaveTimeout: ReturnType<typeof setTimeout> | null;
}

const guildStates = new Map<string, GuildVoiceState>();

function cancelLeaveTimeout(state: GuildVoiceState): void {
  if (state.leaveTimeout) {
    clearTimeout(state.leaveTimeout);
    state.leaveTimeout = null;
  }
}

function processQueue(guildId: string): void {
  const state = guildStates.get(guildId);
  if (!state) return;

  if (state.queue.length === 0) {
    state.isPlaying = false;
    scheduleLeave(guildId);
    return;
  }

  const item = state.queue.shift()!;
  state.isPlaying = true;

  const stream = Readable.from(item.buffer);
  const resource = createAudioResource(stream, {
    inputType: StreamType.Arbitrary,
  });

  state.player.play(resource);

  state.player.once(AudioPlayerStatus.Idle, () => {
    item.resolve();
    processQueue(guildId);
  });
}

function scheduleLeave(guildId: string, delayMs: number = 30_000): void {
  const state = guildStates.get(guildId);
  if (!state) return;

  cancelLeaveTimeout(state);

  state.leaveTimeout = setTimeout(() => {
    const channel = state.connection.joinConfig.channelId;
    logger.info(`Leaving empty voice channel in guild ${guildId} (channel: ${channel})`);
    leaveChannel(guildId);
  }, delayMs);
}

async function ensureConnection(
  channel: VoiceBasedChannel
): Promise<GuildVoiceState> {
  const guildId = channel.guild.id;
  const existing = guildStates.get(guildId);

  if (existing) {
    cancelLeaveTimeout(existing);

    // If already in the same channel, reuse
    if (existing.connection.joinConfig.channelId === channel.id) {
      return existing;
    }

    // Different channel — destroy old and create new
    existing.connection.destroy();
    guildStates.delete(guildId);
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
  });

  // Handle unexpected disconnects
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
      // Seems to be reconnecting
    } catch {
      // Not reconnecting — destroy
      leaveChannel(guildId);
    }
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  } catch {
    connection.destroy();
    throw new Error(`Failed to connect to voice channel in guild ${guildId}`);
  }

  const player = createAudioPlayer();
  connection.subscribe(player);

  const state: GuildVoiceState = {
    connection,
    player,
    queue: [],
    isPlaying: false,
    leaveTimeout: null,
  };

  guildStates.set(guildId, state);
  logger.info(`Joined voice channel "${channel.name}" in guild "${channel.guild.name}"`);

  return state;
}

export async function playAnnouncement(
  channel: VoiceBasedChannel,
  audioBuffer: Buffer
): Promise<void> {
  const state = await ensureConnection(channel);
  cancelLeaveTimeout(state);

  return new Promise<void>((resolve) => {
    state.queue.push({ buffer: audioBuffer, resolve });

    if (!state.isPlaying) {
      processQueue(channel.guild.id);
    }
  });
}

export function leaveChannel(guildId: string): void {
  const state = guildStates.get(guildId);
  if (!state) return;

  cancelLeaveTimeout(state);
  state.player.stop();
  state.connection.destroy();
  guildStates.delete(guildId);
  logger.debug(`Cleaned up voice state for guild ${guildId}`);
}

export function destroyAll(): void {
  for (const [guildId] of guildStates) {
    leaveChannel(guildId);
  }
  logger.info("All voice connections destroyed");
}
