import Store from 'electron-store'
import type { AnimeMetadata } from '../shared/types'

interface CacheEntry {
  data: AnimeMetadata | null
  fetchedAt: number
}

interface CacheSchema {
  entries: Record<string, CacheEntry>
}

// Successful lookups rarely change (poster/synopsis are static); cache them longer.
// Misses (anime not found) get a shorter TTL so a later rename/retry isn't stuck.
const TTL_HIT_MS = 30 * 24 * 60 * 60 * 1000
const TTL_MISS_MS = 3 * 24 * 60 * 60 * 1000

// Separate file from settings.json so clearing the cache never touches user preferences.
// Keys are stored inside a single top-level object (not as store keys themselves) so
// anime titles containing dots don't get misread as electron-store's dot-notation paths.
const cacheStore = new Store<CacheSchema>({
  name: 'metadata-cache',
  defaults: { entries: {} }
})

export function getCachedMetadata(key: string): AnimeMetadata | null | undefined {
  const entry = cacheStore.store.entries[key]
  if (!entry) return undefined
  const ttl = entry.data ? TTL_HIT_MS : TTL_MISS_MS
  if (Date.now() - entry.fetchedAt > ttl) return undefined
  return entry.data
}

export function setCachedMetadata(key: string, data: AnimeMetadata | null): void {
  const entries = cacheStore.store.entries
  entries[key] = { data, fetchedAt: Date.now() }
  cacheStore.set('entries', entries)
}

export function clearMetadataCache(): void {
  cacheStore.set('entries', {})
}
