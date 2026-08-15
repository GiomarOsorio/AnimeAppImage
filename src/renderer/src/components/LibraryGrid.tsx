import { useEffect, useRef } from 'react'
import type { Anime, AnimeMetadata } from '../../../shared/types'
import AnimeCard from './AnimeCard'

interface Props {
  animes: Anime[]
  metadataByName: Record<string, AnimeMetadata | null>
  focusedIndex: number
  favorites: string[]
  dimmed?: boolean
  onSelect: (index: number) => void
}

export const GRID_COLUMNS = 5

export default function LibraryGrid({
  animes,
  metadataByName,
  focusedIndex,
  favorites,
  dimmed,
  onSelect
}: Props): JSX.Element {
  const gridRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (dimmed) return
    // Querying for the focused element after commit (rather than tracking it
    // via a conditionally-assigned ref) avoids depending on the order React
    // attaches/detaches refs across sibling cards — which, for this exact
    // per-item conditional-ref pattern, turned out to differ by direction:
    // moving to a later DOM sibling attaches-then-detaches (fine), moving to
    // an earlier one detaches-then-attaches, so the detach's null clobbered
    // the just-set ref and scrollIntoView silently ran on nothing.
    gridRef.current?.querySelector('.anime-card.focused')?.scrollIntoView({ block: 'nearest' })
  }, [focusedIndex, dimmed])

  return (
    <div
      ref={gridRef}
      className={`library-grid${dimmed ? ' dimmed' : ''}`}
      style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)` }}
    >
      {animes.map((anime, index) => (
        <AnimeCard
          key={anime.path}
          name={anime.name}
          metadata={metadataByName[anime.name]}
          focused={!dimmed && index === focusedIndex}
          isFavorite={favorites.includes(anime.name)}
          onSelect={() => onSelect(index)}
        />
      ))}
    </div>
  )
}
