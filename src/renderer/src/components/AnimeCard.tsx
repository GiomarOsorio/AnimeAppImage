import type { AnimeMetadata } from '../../../shared/types'

interface Props {
  name: string
  metadata: AnimeMetadata | null | undefined
  focused: boolean
  isFavorite: boolean
}

export default function AnimeCard({ name, metadata, focused, isFavorite }: Props): JSX.Element {
  return (
    <div className={`anime-card${focused ? ' focused' : ''}`}>
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
