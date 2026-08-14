import type { AnimeMetadata } from '../shared/types'

const JIKAN_URL = 'https://api.jikan.moe/v4/anime'
const MAL_URL = 'https://api.myanimelist.net/v2/anime'
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

const MAL_FIELDS =
  'id,title,alternative_titles,main_picture,synopsis,mean,genres,num_episodes,status'

async function fetchFromMal(searchTitle: string, clientId: string): Promise<AnimeMetadata | null> {
  const url = `${MAL_URL}?q=${encodeURIComponent(searchTitle)}&limit=1&fields=${MAL_FIELDS}`
  const res = await fetch(url, { headers: { 'X-MAL-CLIENT-ID': clientId } })
  if (!res.ok) return null
  const json = await res.json()
  const node = json?.data?.[0]?.node
  if (!node) return null

  const synopsisEn: string | null = node.synopsis ?? null
  const synopsisEs = synopsisEn ? await translateToSpanish(synopsisEn) : null

  return {
    id: node.id,
    title: node.alternative_titles?.en || node.title,
    description: synopsisEs,
    coverImage: node.main_picture?.large ?? node.main_picture?.medium ?? null,
    bannerImage: null,
    genres: (node.genres ?? []).map((g: { name: string }) => g.name),
    episodes: node.num_episodes ?? null,
    score: node.mean ?? null
  }
}

async function fetchFromJikan(searchTitle: string): Promise<AnimeMetadata | null> {
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
}

export async function fetchMetadata(
  searchTitle: string,
  malClientId: string | null
): Promise<AnimeMetadata | null> {
  return throttled(async () => {
    if (malClientId) {
      try {
        const result = await fetchFromMal(searchTitle, malClientId)
        if (result) return result
      } catch {
        // fall through to Jikan
      }
    }
    return fetchFromJikan(searchTitle)
  })
}

export async function testMalClientId(clientId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${MAL_URL}?q=one&limit=1`, {
      headers: { 'X-MAL-CLIENT-ID': clientId }
    })
    if (res.ok) return { ok: true, message: 'Client ID válido' }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Client ID inválido o no autorizado' }
    }
    return { ok: false, message: `MyAnimeList respondió con error ${res.status}` }
  } catch {
    return { ok: false, message: 'No se pudo conectar con MyAnimeList' }
  }
}
