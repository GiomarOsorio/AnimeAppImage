import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { AnimeMetadata } from '../shared/types'

// Written by jkanime_dl next to the video files: <libraryPath>/<anime>/metadata.json,
// one file per anime (not per season). Already in Spanish — no translation needed.
interface JkanimeMetadataFile {
  titulo?: string
  titulo_alternativo?: string
  sinopsis?: string
  imagen?: string
  generos?: string[]
  episodios?: number
}

// Only trust it for the fields the UI actually leans on. If any of those are
// missing, fall through to MyAnimeList/Jikan instead of showing a half-empty
// card — this is a local-first shortcut, not a replacement for that lookup.
export async function readLocalMetadata(animePath: string): Promise<AnimeMetadata | null> {
  let raw: string
  try {
    raw = await readFile(join(animePath, 'metadata.json'), 'utf-8')
  } catch {
    return null
  }

  let data: JkanimeMetadataFile
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }

  const title = data.titulo?.trim()
  const description = data.sinopsis?.trim()
  const coverImage = data.imagen?.trim()
  if (!title || !description || !coverImage) return null

  return {
    id: 0,
    title,
    description,
    coverImage,
    bannerImage: null,
    genres: data.generos ?? [],
    episodes: data.episodios ?? null,
    score: null
  }
}

// Called after a MyAnimeList/Jikan fallback fetch succeeds, so the next
// launch finds a usable metadata.json and never has to hit the API again for
// that anime. Merges into whatever's already there instead of overwriting —
// an existing (even partial) file was written by jkanime_dl and its fields
// take priority; this only fills in what's missing. Best-effort: a read-only
// mount (NAS) shouldn't break metadata fetching, so failures are swallowed
// by the caller, not thrown here.
export async function writeLocalMetadata(animePath: string, metadata: AnimeMetadata): Promise<void> {
  const filePath = join(animePath, 'metadata.json')

  let existing: JkanimeMetadataFile = {}
  try {
    existing = JSON.parse(await readFile(filePath, 'utf-8'))
  } catch {
    // no file yet, or not valid JSON — start from scratch
  }

  const merged: JkanimeMetadataFile = {
    ...existing,
    titulo: existing.titulo ?? metadata.title,
    sinopsis: existing.sinopsis ?? metadata.description ?? undefined,
    imagen: existing.imagen ?? metadata.coverImage ?? undefined,
    generos: existing.generos ?? (metadata.genres.length > 0 ? metadata.genres : undefined),
    episodios: existing.episodios ?? metadata.episodes ?? undefined
  }

  await writeFile(filePath, JSON.stringify(merged, null, 2), 'utf-8')
}
