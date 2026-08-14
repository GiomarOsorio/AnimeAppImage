import { readdir } from 'fs/promises'
import path from 'path'
import type { Anime, Episode, Season } from '../shared/types'

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.avi', '.webm', '.mov'])

async function listDirs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

async function listEpisodes(dir: string): Promise<Episode[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && VIDEO_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => ({ name: e.name, path: path.join(dir, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

export async function scanLibrary(rootDir: string): Promise<Anime[]> {
  const animeNames = await listDirs(rootDir)
  const animes: Anime[] = []

  for (const animeName of animeNames) {
    const animePath = path.join(rootDir, animeName)
    const seasonNames = await listDirs(animePath)
    const seasons: Season[] = []

    for (const seasonName of seasonNames) {
      const seasonPath = path.join(animePath, seasonName)
      const episodes = await listEpisodes(seasonPath)
      if (episodes.length > 0) {
        seasons.push({ name: seasonName, episodes })
      }
    }

    seasons.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    animes.push({ name: animeName, path: animePath, seasons })
  }

  animes.sort((a, b) => a.name.localeCompare(b.name))
  return animes
}
