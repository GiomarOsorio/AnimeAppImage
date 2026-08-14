import type { Anime, AnimeMetadata } from '../../../shared/types'
import AnimeCard from './AnimeCard'

interface Props {
  animes: Anime[]
  metadataByName: Record<string, AnimeMetadata | null>
  focusedIndex: number
  favorites: string[]
}

export const GRID_COLUMNS = 5

export default function LibraryGrid({ animes, metadataByName, focusedIndex, favorites }: Props): JSX.Element {
  return (
    <div className="library-grid" style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)` }}>
      {animes.map((anime, index) => (
        <AnimeCard
          key={anime.path}
          name={anime.name}
          metadata={metadataByName[anime.name]}
          focused={index === focusedIndex}
          isFavorite={favorites.includes(anime.name)}
        />
      ))}
    </div>
  )
}
