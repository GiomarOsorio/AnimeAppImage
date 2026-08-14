import type { AnimeMetadata } from '../shared/types'

const JIKAN_URL = 'https://api.jikan.moe/v4/anime'
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get'

// Jikan rate limit: 3 req/s, 60 req/min. Serialize with a floor delay between calls.
let lastCallAt = 0
const MIN_INTERVAL_MS = 400
let queue: Promise<unknown> = Promise.resolve()

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now())
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastCallAt = Date.now()
    return fn()
  })
  queue = run.catch(() => undefined)
  return run
}

async function translateToSpanish(text: string): Promise<string> {
  try {
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text.slice(0, 490))}&langpair=en|es`
    const res = await fetch(url)
    if (!res.ok) return text
    const json = await res.json()
    const translated = json?.responseData?.translatedText
    return typeof translated === 'string' && translated.length > 0 ? translated : text
  } catch {
    return text
  }
}

export async function fetchMetadata(searchTitle: string): Promise<AnimeMetadata | null> {
  return throttled(async () => {
    try {
      const res = await fetch(`${JIKAN_URL}?q=${encodeURIComponent(searchTitle)}&limit=1`)
      if (!res.ok) return null
      const json = await res.json()
      const anime = json?.data?.[0]
      if (!anime) return null

      const synopsisEn: string | null = anime.synopsis ?? null
      const synopsisEs = synopsisEn ? await translateToSpanish(synopsisEn) : null

      return {
        id: anime.mal_id,
        title: anime.title_english ?? anime.title,
        description: synopsisEs,
        coverImage: anime.images?.jpg?.large_image_url ?? anime.images?.jpg?.image_url ?? null,
        bannerImage: null,
        genres: (anime.genres ?? []).map((g: { name: string }) => g.name),
        episodes: anime.episodes ?? null,
        score: anime.score ?? null
      }
    } catch {
      return null
    }
  })
}
