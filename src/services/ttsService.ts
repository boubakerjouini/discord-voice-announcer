import googleTTS from "google-tts-api";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const cache = new Map<string, Buffer>();
const MAX_CACHE_SIZE = 50;

export async function generateTTSBuffer(
  text: string,
  lang: string = config.ttsLang
): Promise<Buffer> {
  const cacheKey = `${lang}:${text}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.debug(`TTS cache hit: "${text}"`);
    return cached;
  }

  logger.debug(`Generating TTS: "${text}" (lang: ${lang})`);
  const base64 = await googleTTS.getAudioBase64(text, { lang, slow: false });
  const buffer = Buffer.from(base64, "base64");

  // Evict oldest entry if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value!;
    cache.delete(firstKey);
  }
  cache.set(cacheKey, buffer);

  return buffer;
}
