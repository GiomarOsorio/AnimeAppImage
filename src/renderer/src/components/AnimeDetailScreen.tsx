import { useEffect, useRef } from 'react'
import type { Anime, AnimeMetadata, WatchProgress } from '../../../shared/types'
import ControlsLegend from './ControlsLegend'
import { isInProgress, isWatched, progressFraction } from '../utils/progress'
import { formatTime } from '../utils/time'
import { seasonIndexForEpisode, seasonStartIndices } from '../utils/seasons'

interface Props {
  anime: Anime
  metadata: AnimeMetadata | null | undefined
  episodeIndex: number
  isFavorite: boolean
  watchProgress: Record<string, WatchProgress>
  onPlayEpisode: (index: number) => void
  onSelectSeason: (seasonIndex: number) => void
}

export default function AnimeDetailScreen({
  anime,
  metadata,
  episodeIndex,
  isFavorite,
  watchProgress,
  onPlayEpisode,
  onSelectSeason
}: Props): JSX.Element {
  const backdrop = metadata?.coverImage ?? null
  const episodeCount = anime.seasons.reduce((n, s) => n + s.episodes.length, 0)
  const episodesListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // See LibraryGrid's identical fix for why this queries after commit
    // instead of tracking the focused row via a conditionally-assigned ref.
    episodesListRef.current?.querySelector('.episode-row.focused')?.scrollIntoView({ block: 'nearest' })
  }, [episodeIndex])

  let watchedCount = 0
  let resumable: { index: number; name: string; progress: WatchProgress } | null = null
  let scanIndex = -1
  for (const season of anime.seasons) {
    for (const ep of season.episodes) {
      scanIndex++
      const p = watchProgress[ep.path]
      if (isWatched(p)) watchedCount++
      if (isInProgress(p) && (!resumable || p.updatedAt > resumable.progress.updatedAt)) {
        resumable = { index: scanIndex, name: ep.name, progress: p }
      }
    }
  }

  const seasonStarts = seasonStartIndices(anime)
  const currentSeasonIndex = seasonIndexForEpisode(anime, episodeIndex)
  const currentSeason = anime.seasons[currentSeasonIndex]
  const currentSeasonStart = seasonStarts[currentSeasonIndex] ?? 0

  return (
    <div className="detail-screen">
      {backdrop && <div className="detail-backdrop" style={{ backgroundImage: `url(${backdrop})` }} />}
      <div className="detail-gradient" />

      <div className="detail-content">
        <div className="detail-poster-col">
          {metadata?.coverImage && <img className="detail-poster" src={metadata.coverImage} alt="" />}
          {isFavorite && (
            <div className="detail-fav-pill">
              <span>★</span>
              <span>En favoritos</span>
            </div>
          )}
        </div>

        <div className="detail-info">
          <div className="detail-eyebrow">Carpeta · {anime.name}</div>
          <h1>{metadata?.title ?? anime.name}</h1>
          <div className="detail-badges">
            {metadata?.score != null && (
              <span className="badge badge-score">
                <span>★</span>
                {metadata.score.toFixed(1)}
              </span>
            )}
            {metadata?.episodes != null && <span className="badge">{metadata.episodes} episodios</span>}
            {metadata?.genres.map((g) => (
              <span key={g} className="badge">
                {g}
              </span>
            ))}
          </div>
          {metadata?.description && <p className="detail-synopsis">{metadata.description}</p>}

          {resumable && (
            <div className="detail-actions">
              <button className="detail-resume-btn" onClick={() => onPlayEpisode(resumable!.index)}>
                <span className="detail-resume-key">A</span>
                <span>
                  Reanudar {resumable.name} · {formatTime(resumable.progress.position)}
                </span>
              </button>
              <button className="detail-restart-btn" onClick={() => onPlayEpisode(0)}>
                Ver desde el principio
              </button>
            </div>
          )}
        </div>

        <div className="detail-episodes-panel">
          <div className="detail-episodes-header">
            <div className="detail-episodes-title">Episodios</div>
            <div className="detail-episodes-count">
              {anime.seasons.length} temporadas · {episodeCount} archivos · {watchedCount} vistos
            </div>
          </div>

          {anime.seasons.length > 1 && (
            <div className="detail-season-tabs">
              {anime.seasons.map((season, index) => (
                <button
                  key={season.name}
                  className={`detail-season-tab${index === currentSeasonIndex ? ' active' : ''}`}
                  onClick={() => onSelectSeason(index)}
                >
                  {season.name}
                </button>
              ))}
            </div>
          )}

          <div className="detail-episodes-list" ref={episodesListRef}>
            {currentSeason?.episodes.map((ep, i) => {
              const index = currentSeasonStart + i
              const isFocused = index === episodeIndex
              const progress = watchProgress[ep.path]
              const watched = isWatched(progress)
              const frac = progressFraction(progress)
              return (
                <div
                  key={ep.path}
                  className={`episode-row${isFocused ? ' focused' : ''}${watched ? ' watched' : ''}`}
                  onClick={() => onPlayEpisode(index)}
                >
                  <div className="episode-row-main">
                    <span>{ep.name}</span>
                    {watched && <span className="episode-row-check">✓</span>}
                  </div>
                  {frac > 0.02 && !watched && (
                    <div className="episode-row-progress">
                      <div className="episode-row-progress-fill" style={{ width: `${frac * 100}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <ControlsLegend
        items={[
          { key: 'A', label: 'Reproducir episodio', tone: 'accent' },
          { key: '▲▼', label: 'Cambiar episodio' },
          ...(anime.seasons.length > 1
            ? [{ key: '◀▶', label: 'Cambiar temporada' }]
            : []),
          { key: 'B', label: 'Volver a la biblioteca' }
        ]}
      />
    </div>
  )
}
