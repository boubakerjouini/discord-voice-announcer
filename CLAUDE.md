# Discord Voice Announcer

A Discord bot that announces via TTS when users join or leave voice channels.

## Tech Stack

- TypeScript (strict mode) with ESM modules
- discord.js v14 for Discord API
- @discordjs/voice for voice connections
- @discordjs/opus for Opus encoding
- google-tts-api for text-to-speech (Google Translate TTS, no API key needed)
- ffmpeg-static for audio demuxing
- Node.js 22, pnpm

## How to Run

- `pnpm install` — install dependencies
- Copy `.env.example` to `.env` and set `DISCORD_BOT_TOKEN`
- `pnpm dev` — run in development mode with hot reload
- `pnpm build && pnpm start` — production build and run

## Project Structure

- `src/index.ts` — entry point, client setup, shutdown
- `src/config.ts` — env var loading and validation
- `src/events/ready.ts` — bot online event handler
- `src/events/voiceStateUpdate.ts` — core join/leave detection and TTS triggering
- `src/services/ttsService.ts` — Google TTS generation with in-memory cache
- `src/services/voiceService.ts` — voice connections, audio player, per-guild queue
- `src/utils/logger.ts` — timestamped console logger with levels

## Coding Conventions

- All files use ESM (`import`/`export`), file extensions in imports (`.js`)
- Strict TypeScript, no `any` unless absolutely necessary
- Async/await over raw Promises
- Error handling: try/catch in all event handlers, never let handlers throw
- Logging: use the logger from `src/utils/logger.ts`, not bare `console.log`
- Voice connections are managed per-guild in a Map in voiceService
- Bot leaves voice channels after 30s of inactivity with no humans present

## Discord Bot Setup

1. Create app at https://discord.com/developers/applications
2. Bot tab: copy token, paste in `.env`
3. No privileged intents needed
4. OAuth2 > URL Generator: select `bot` scope, permissions: `Connect`, `Speak`
5. Use generated URL to invite bot to your server

## Key Decisions

- google-tts-api uses Google Translate's free TTS endpoint (no API key needed)
- Announcements are queued per-guild to prevent overlapping audio
- The bot joins a channel on first join event, leaves when empty after 30s
- TTS buffers are cached in-memory to avoid re-fetching identical phrases
