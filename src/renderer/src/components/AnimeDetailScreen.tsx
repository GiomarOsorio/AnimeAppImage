import type { Anime, AnimeMetadata } from '../../../shared/types'

interface Props {
  anime: Anime
  metadata: AnimeMetadata | null | undefined
  episodeIndex: number
}

export default function AnimeDetailScreen({ anime, metadata, episodeIndex }: Props): JSX.Element {
  let epCounter = -1
  const backdrop = metadata?.bannerImage ?? metadata?.coverImage ?? null

  return (
    <div className="detail-screen">
      <div className="detail-hero">
        {backdrop && (
          <div className="detail-hero-backdrop" style={{ backgroundImage: `url(${backdrop})` }} />
        )}
        <div className="detail-hero-gradient" />
        <div className="detail-hero-content">
          {metadata?.coverImage && <img className="detail-poster" src={metadata.coverImage} alt="" />}
          <div className="detail-info">
            <h1>{metadata?.title ?? anime.name}</h1>
            <div className="detail-badges">
              {metadata?.score != null && <span className="badge">★ {metadata.score.toFixed(1)}</span>}
              {metadata?.episodes != null && <span className="badge">{metadata.episodes} episodios</span>}
              {metadata?.genres.map((g) => (
                <span key={g} className="badge">
                  {g}
                </span>
              ))}
            </div>
            {metadata?.description && <p className="detail-synopsis">{metadata.description}</p>}
          </div>
        </div>
      </div>

      <div className="detail-episodes">
        {anime.seasons.map((season) => (
          <div key={season.name}>
            <div className="season-header">{season.name}</div>
            {season.episodes.map((ep) => {
              epCounter++
              const isFocused = epCounter === episodeIndex
              return (
                <div key={ep.path} className={`episode-row${isFocused ? ' focused' : ''}`}>
                  {ep.name}
                </div>
              )
            })}
          </div>
        ))}
        <p className="hint">Esc / B para volver</p>
      </div>
    </div>
  )
}
