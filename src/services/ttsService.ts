import googleTTS from "google-tts-api";
import { logger } from "../utils/logger.js";

const cache = new Map<string, Buffer>();
const MAX_CACHE_SIZE = 100;

export async function generateTTSBuffer(
  text: string,
  lang: string = "en",
  slow: boolean = false
): Promise<Buffer> {
  const cacheKey = `${lang}:${slow}:${text}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.debug(`TTS cache hit: "${text}"`);
    return cached;
  }

  logger.debug(`Generating TTS: "${text}" (lang: ${lang}, slow: ${slow})`);
  const base64 = await googleTTS.getAudioBase64(text, { lang, slow });
  const buffer = Buffer.from(base64, "base64");

  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value!;
    cache.delete(firstKey);
  }
  cache.set(cacheKey, buffer);

  return buffer;
}
