import type { AnimeMetadata } from '../../../shared/types'

interface Props {
  name: string
  metadata: AnimeMetadata | null | undefined
  focused: boolean
  isFavorite: boolean
  onSelect: () => void
}

export default function AnimeCard({ name, metadata, focused, isFavorite, onSelect }: Props): JSX.Element {
  return (
    <div className={`anime-card${focused ? ' focused' : ''}`} onClick={onSelect}>
      {isFavorite && <span className="favorite-badge">★</span>}
      {metadata?.coverImage ? (
        <img src={metadata.coverImage} alt={name} draggable={false} />
      ) : (
        <div className="anime-card-placeholder">{name}</div>
      )}
      <div className="anime-card-title">{metadata?.title ?? name}</div>
    </div>
  )
}
