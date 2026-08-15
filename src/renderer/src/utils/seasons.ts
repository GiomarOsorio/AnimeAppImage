import type { Anime } from '../../../shared/types'

export function seasonStartIndices(anime: Anime): number[] {
  const starts: number[] = []
  let idx = 0
  for (const season of anime.seasons) {
    starts.push(idx)
    idx += season.episodes.length
  }
  return starts
}

export function seasonIndexForEpisode(anime: Anime, episodeIndex: number): number {
  const starts = seasonStartIndices(anime)
  let result = 0
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= episodeIndex) result = i
  }
  return result
}
