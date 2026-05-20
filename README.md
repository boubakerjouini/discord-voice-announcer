# Discord Voice Announcer

**A Discord bot that announces when users join or leave voice channels using text-to-speech.**

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue)

Never miss someone silently joining your voice channel again. This bot listens for voice state changes across all your servers and plays a spoken announcement directly in the voice channel whenever someone joins, leaves, or switches channels.

---

## Features

- **Join/Leave announcements** — plays "[Name] has joined/left the channel" via TTS in the voice channel
- **Channel switch detection** — announces the leave in the old channel and the join in the new one
- **Per-guild audio queue** — announcements play sequentially, never overlapping
- **Auto-leave** — bot leaves the voice channel after 30 seconds of inactivity when no humans remain
- **TTS caching** — in-memory cache (up to 50 phrases) avoids redundant TTS requests
- **Multi-server support** — works across all servers the bot is invited to simultaneously
- **Configurable language** — change the TTS language via environment variable (supports all Google Translate languages)
- **Graceful shutdown** — cleanly disconnects from all voice channels on SIGINT/SIGTERM

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| [Node.js](https://nodejs.org/) | >= 22.0.0 |
| [pnpm](https://pnpm.io/) | >= 10.x |
| Discord bot application | — |

---

## Discord Bot Setup

Follow these steps to create and configure your Discord bot:

### 1. Create an Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"**
3. Give it a name (e.g., "Voice Announcer") and click **Create**

### 2. Create the Bot

1. In your application, go to the **Bot** tab in the left sidebar
2. Click **"Reset Token"** to generate a new token
3. **Copy the token** — you will need it for the `.env` file
4. Keep this token secret. Never commit it to version control.

### 3. Configure Intents

This bot only requires **non-privileged** intents. No special toggles are needed in the Developer Portal. The required intents (`Guilds` and `GuildVoiceStates`) are enabled by default.

### 4. Generate an Invite Link

1. Go to the **OAuth2** tab in the left sidebar
2. In **OAuth2 URL Generator**, check the `bot` scope
3. Under **Bot Permissions**, check:
   - `Connect` — allows the bot to join voice channels
   - `Speak` — allows the bot to play audio in voice channels
4. Copy the generated URL and open it in your browser
5. Select the server you want to add the bot to and click **Authorize**

---

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/discord-voice-announcer.git
cd discord-voice-announcer

# Install dependencies
pnpm install

# Create your environment file
cp .env.example .env
```

Open `.env` and paste your bot token:

```env
DISCORD_BOT_TOKEN=your-bot-token-here
TTS_LANG=en
LOG_LEVEL=info
```

---

## Usage

### Development (with hot reload)

```bash
pnpm dev
```

This uses `tsx --watch` to run TypeScript directly and restart on file changes.

### Production

```bash
# Compile TypeScript
pnpm build

# Run the compiled JavaScript
pnpm start
```

### What to Expect

Once the bot is running, you will see:

```
[2026-05-20T14:30:00.000Z] [INFO] Bot is online as VoiceAnnouncer#1234, serving 3 guild(s)
```

When someone joins a voice channel:

```
[2026-05-20T14:30:15.000Z] [INFO] [My Server] Alice has joined the channel
```

The bot will join the voice channel and play "Alice has joined the channel" via TTS. When Alice leaves, it will play "Alice has left the channel". If no humans remain, the bot auto-leaves after 30 seconds.

---

## Configuration

All configuration is done via environment variables in the `.env` file.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_BOT_TOKEN` | Yes | — | Your bot token from the Discord Developer Portal |
| `TTS_LANG` | No | `en` | Language code for TTS announcements (see [supported languages](#supported-tts-languages)) |
| `LOG_LEVEL` | No | `info` | Logging verbosity: `debug`, `info`, `warn`, or `error` |

### Supported TTS Languages

The bot uses Google Translate's TTS engine. Any language code supported by Google Translate will work. Common examples:

| Code | Language |
|------|----------|
| `en` | English |
| `fr` | French |
| `es` | Spanish |
| `de` | German |
| `pt` | Portuguese |
| `ja` | Japanese |
| `ko` | Korean |
| `ar` | Arabic |
| `zh` | Chinese (Mandarin) |
| `ru` | Russian |

---

## Project Structure

```
discord-voice-announcer/
├── .claude/
│   └── settings.json           # Claude Code configuration
├── src/
│   ├── index.ts                # Entry point — client setup, event registration, shutdown
│   ├── config.ts               # Environment variable loading and validation
│   ├── events/
│   │   ├── ready.ts            # Bot online handler — logs status, sets activity
│   │   └── voiceStateUpdate.ts # Core logic — detects join/leave/switch, triggers TTS
│   ├── services/
│   │   ├── ttsService.ts       # Google TTS → MP3 buffer conversion with caching
│   │   └── voiceService.ts     # Voice connections, audio player, per-guild queue
│   └── utils/
│       └── logger.ts           # Timestamped console logger with configurable levels
├── .env.example                # Template for environment variables
├── .gitignore                  # Excludes node_modules, dist, .env
├── CLAUDE.md                   # Claude Code project context
├── README.md                   # This file
├── package.json                # Dependencies and scripts
└── tsconfig.json               # TypeScript compiler configuration
```

---

## Architecture

### Event Flow

```
Discord Gateway
     │
     ▼
VoiceStateUpdate event
     │
     ▼
voiceStateUpdate.ts
     │
     ├─ Ignore bots (prevent self-loop)
     ├─ Ignore non-channel events (mute, deaf, etc.)
     │
     ├─ JOIN:  user entered a channel
     ├─ LEAVE: user left a channel
     └─ SWITCH: user moved between channels
           │
           ▼
    ttsService.ts
    ┌─────────────────────┐
    │ Check in-memory cache│
    │    (50 entries max)  │
    ├─────────────────────┤
    │ Cache miss? Call     │
    │ Google TTS API       │
    │ → base64 → Buffer   │
    └─────────────────────┘
           │
           ▼
    voiceService.ts
    ┌─────────────────────┐
    │ ensureConnection()   │
    │ → join or reuse      │
    ├─────────────────────┤
    │ Enqueue audio buffer │
    │ → FIFO playback      │
    ├─────────────────────┤
    │ Queue empty?         │
    │ → schedule auto-leave│
    │   (30s timeout)      │
    └─────────────────────┘
```

### Voice Connection Lifecycle

1. **Join** — When the first user joins a voice channel, the bot connects to that channel
2. **Reuse** — If the bot is already in the same channel, it reuses the existing connection
3. **Switch** — If needed in a different channel (same guild), the old connection is destroyed and a new one is created
4. **Auto-leave** — After the last announcement finishes and no new ones arrive for 30 seconds, if no human members remain in the channel, the bot disconnects
5. **Disconnect recovery** — If the bot is unexpectedly disconnected, it attempts to reconnect within 5 seconds before giving up

### Per-Guild State Management

Each guild maintains an independent state:

```
GuildVoiceState {
  connection    — Active VoiceConnection to the channel
  player        — AudioPlayer instance for playback
  queue         — FIFO queue of pending announcements
  isPlaying     — Whether audio is currently playing
  leaveTimeout  — Timer for auto-leave (30s after last announcement)
}
```

All guild states are stored in a `Map<string, GuildVoiceState>` keyed by guild ID, ensuring servers never interfere with each other.

### TTS Caching

The TTS service maintains an in-memory cache of up to 50 generated audio buffers. Cache keys are `lang:text` (e.g., `en:Alice has joined the channel`). When the cache is full, the oldest entry is evicted (FIFO). This prevents redundant API calls when the same user joins and leaves repeatedly.

---

## API Reference

### `ttsService.ts`

#### `generateTTSBuffer(text: string, lang?: string): Promise<Buffer>`

Generates an MP3 audio buffer from text using Google Translate's TTS API.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `text` | `string` | — | The text to convert to speech |
| `lang` | `string` | `config.ttsLang` | Language code |

**Returns:** `Promise<Buffer>` — MP3 audio data

---

### `voiceService.ts`

#### `playAnnouncement(channel: VoiceBasedChannel, audioBuffer: Buffer): Promise<void>`

Joins the specified voice channel (if not already connected) and queues the audio buffer for playback.

| Parameter | Type | Description |
|-----------|------|-------------|
| `channel` | `VoiceBasedChannel` | The voice channel to play in |
| `audioBuffer` | `Buffer` | MP3 audio data to play |

**Returns:** `Promise<void>` — Resolves when playback of this specific buffer completes.

#### `leaveChannel(guildId: string): void`

Immediately disconnects the bot from the voice channel in the specified guild and cleans up all state.

| Parameter | Type | Description |
|-----------|------|-------------|
| `guildId` | `string` | The Discord guild (server) ID |

#### `destroyAll(): void`

Disconnects from all voice channels across all guilds. Called during graceful shutdown.

---

## Troubleshooting

### `@discordjs/opus` fails to install

The native Opus library requires a prebuilt binary for your platform. If it fails:

```bash
# Remove the native opus library
pnpm remove @discordjs/opus

# Install the pure JavaScript alternative
pnpm add opusscript
```

The voice library (`@discordjs/voice`) auto-detects whichever Opus implementation is available.

### Bot joins but doesn't speak

- **Check permissions:** The bot needs both `Connect` and `Speak` permissions in the voice channel. Check server settings and channel-level permission overrides.
- **Check ffmpeg:** The bot requires ffmpeg for audio processing. It's bundled via `ffmpeg-static`, but verify it installed correctly:
  ```bash
  node -e "console.log(require('ffmpeg-static'))"
  ```
  This should print a path to the ffmpeg binary.

### No announcements are triggered

- **Verify intents:** Ensure the client is created with `GatewayIntentBits.GuildVoiceStates`. This is already configured in `src/index.ts`.
- **Check the logs:** Set `LOG_LEVEL=debug` in `.env` to see all events being processed.
- **Bot ignores itself:** By design, the bot ignores its own voice state changes and those of other bots.

### Google TTS rate limiting

The bot uses Google Translate's free (unofficial) TTS endpoint. Under heavy usage, Google may rate-limit requests. Mitigations:

- The in-memory cache reduces redundant requests for identical phrases
- For high-traffic bots, consider a local TTS engine (e.g., `espeak`, `pico2wave`) as a replacement for `google-tts-api`

### Bot doesn't leave empty channels

The auto-leave timer is set to 30 seconds. If the bot stays longer:

- Ensure no other bots are in the channel (they count as non-human members but are filtered by the `hasHumanMembers` check)
- Set `LOG_LEVEL=debug` to verify the leave timer is being scheduled

---

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| `discord.js` | ^14.26.4 | Discord API client |
| `@discordjs/voice` | ^0.19.2 | Voice connections and audio playback |
| `@discordjs/opus` | ^0.10.0 | Opus audio encoding (native, prebuilt) |
| `google-tts-api` | ^2.0.2 | Text-to-speech via Google Translate |
| `ffmpeg-static` | ^5.3.0 | Bundled FFmpeg binary for audio demuxing |
| `dotenv` | ^17.4.2 | Environment variable loading |
| `typescript` | ^6.0.3 | TypeScript compiler (dev) |
| `tsx` | ^4.22.3 | TypeScript runner with watch mode (dev) |
| `@types/node` | ^25.9.1 | Node.js type definitions (dev) |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Ensure TypeScript compiles cleanly (`pnpm build`)
5. Commit your changes (`git commit -m "Add my feature"`)
6. Push to the branch (`git push origin feature/my-feature`)
7. Open a Pull Request

---

## License

This project is licensed under the [ISC License](https://opensource.org/licenses/ISC).
