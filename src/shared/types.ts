export interface Episode {
  name: string
  path: string
}

export interface Season {
  name: string
  episodes: Episode[]
}

export interface Anime {
  name: string
  path: string
  seasons: Season[]
}

export interface AnimeMetadata {
  id: number
  title: string
  description: string | null
  coverImage: string | null
  bannerImage: string | null
  genres: string[]
  episodes: number | null
  score: number | null
}

export interface Settings {
  libraryPath: string | null
  useMetadata: boolean
  favorites: string[]
}
