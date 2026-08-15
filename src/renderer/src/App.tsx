import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Anime, AnimeMetadata, ControlsConfig, WatchProgress } from '../../shared/types'
import { DEFAULT_CONTROLS, type NavAction } from '../../shared/types'
import LibraryGrid, { GRID_COLUMNS } from './components/LibraryGrid'
import { flattenEpisodes } from './components/SeasonEpisodeList'
import AnimeDetailScreen from './components/AnimeDetailScreen'
import VideoPlayer from './components/VideoPlayer'
import TopBar from './components/TopBar'
import HelpModal from './components/HelpModal'
import SettingsScreen from './components/SettingsScreen'
import ControlsLegend from './components/ControlsLegend'
import ContinueWatching from './components/ContinueWatching'
import { useControllerNav } from './hooks/useControllerNav'
import { isInProgress } from './utils/progress'
import { seasonIndexForEpisode, seasonStartIndices } from './utils/seasons'
import { toMediaUrl } from './utils/mediaUrl'

type View = 'library' | 'episodes' | 'player' | 'settings'

export default function App(): JSX.Element {
  const [view, setView] = useState<View>('library')
  const [previousView, setPreviousView] = useState<View>('library')
  const [libraryPath, setLibraryPath] = useState<string | null>(null)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [animes, setAnimes] = useState<Anime[]>([])
  const [metadataByName, setMetadataByName] = useState<Record<string, AnimeMetadata | null>>({})
  const [favorites, setFavorites] = useState<string[]>([])
  const [controls, setControls] = useState<ControlsConfig>(DEFAULT_CONTROLS)
  const [malClientId, setMalClientId] = useState<string | null>(null)
  const [malClientSecret, setMalClientSecret] = useState<string | null>(null)
  const [scanOnStart, setScanOnStart] = useState(true)
  const [watchProgress, setWatchProgress] = useState<Record<string, WatchProgress>>({})
  const [helpOpen, setHelpOpen] = useState(false)
  const [refetchingMetadata, setRefetchingMetadata] = useState(false)
  const [libraryUpdateRunning, setLibraryUpdateRunning] = useState(false)
  const [libraryUpdateLine, setLibraryUpdateLine] = useState<string | null>(null)
  const [libraryUpdateResult, setLibraryUpdateResult] = useState<{ ok: boolean; message: string } | null>(
    null
  )

  const [gridIndex, setGridIndex] = useState(0)
  const [libraryFocus, setLibraryFocus] = useState<'shelf' | 'grid'>('grid')
  const [episodeIndex, setEpisodeIndex] = useState(0)
  const [playingSrc, setPlayingSrc] = useState<string | null>(null)

  useEffect(() => {
    // Moving focus to the continue-watching shelf doesn't move the DOM focus
    // itself (it's all just a CSS class), so without this the shelf can end
    // up "focused" while scrolled out of view above a grid that just went
    // fully dim — indistinguishable from the app being stuck.
    if (libraryFocus === 'shelf') {
      document.querySelector('.continue-watching')?.scrollIntoView({ block: 'nearest' })
    }
  }, [libraryFocus])

  useEffect(() => {
    window.api.getSettings().then((settings) => {
      setFavorites(settings.favorites)
      setLibraryPath(settings.libraryPath)
      setControls(settings.controls)
      setMalClientId(settings.malClientId)
      setMalClientSecret(settings.malClientSecret)
      setScanOnStart(settings.scanOnStart)
      if (settings.scanOnStart) loadLibrary()
    })
    refreshProgress()
  }, [])

  useEffect(() => {
    const offStarted = window.api.onLibraryUpdateStarted(() => {
      setLibraryUpdateRunning(true)
      setLibraryUpdateLine(null)
      setLibraryUpdateResult(null)
    })
    const offOutput = window.api.onLibraryUpdateOutput((line) => {
      const lastLine = line.trim().split('\n').pop()
      if (lastLine) setLibraryUpdateLine(lastLine)
    })
    const offDone = window.api.onLibraryUpdateDone((result) => {
      setLibraryUpdateRunning(false)
      setLibraryUpdateResult(result)
      if (result.ok) loadLibrary()
    })
    return () => {
      offStarted()
      offOutput()
      offDone()
    }
  }, [])

  function runLibraryUpdate(): void {
    if (libraryUpdateRunning) return
    window.api.runLibraryUpdate().then((result) => {
      if (!result.ok && !libraryUpdateRunning) setLibraryUpdateResult(result)
    })
  }

  function loadLibrary(): void {
    window.api.getLibrary().then(({ animes: data, error }) => {
      setAnimes(data)
      setLibraryError(error)
      setGridIndex(0)
      setLibraryFocus('grid')
      for (const anime of data) {
        window.api.fetchMetadata(anime.name, anime.path).then((meta) => {
          setMetadataByName((prev) => ({ ...prev, [anime.name]: meta }))
        })
      }
    })
  }

  function setLibraryPathManually(path: string): void {
    window.api.setLibraryPath(path).then((savedPath) => {
      setLibraryPath(savedPath)
      loadLibrary()
    })
  }

  function refreshProgress(): void {
    window.api.getWatchProgress().then(setWatchProgress)
  }

  function refetchMissingMetadata(): void {
    const missing = animes.filter((a) => metadataByName[a.name] == null)
    if (missing.length === 0) return
    setRefetchingMetadata(true)
    Promise.all(
      missing.map((anime) =>
        window.api.fetchMetadata(anime.name, anime.path, true).then((meta) => {
          setMetadataByName((prev) => ({ ...prev, [anime.name]: meta }))
        })
      )
    ).finally(() => setRefetchingMetadata(false))
  }

  function openSettings(): void {
    setPreviousView(view)
    setView('settings')
  }

  function openAnime(index: number): void {
    setGridIndex(index)
    setEpisodeIndex(0)
    setView('episodes')
  }

  const selectedAnime = animes[gridIndex]
  const episodes = selectedAnime ? flattenEpisodes(selectedAnime) : []

  function playEpisode(index: number): void {
    setEpisodeIndex(index)
    if (episodes[index]) {
      setPlayingSrc(toMediaUrl(episodes[index].path))
      setView('player')
    }
  }

  const continueEntry = useMemo(() => {
    const candidates = Object.values(watchProgress).filter(isInProgress)
    candidates.sort((a, b) => b.updatedAt - a.updatedAt)
    for (const progress of candidates) {
      const animeIndex = animes.findIndex((a) => a.name === progress.animeName)
      if (animeIndex === -1) continue
      const eps = flattenEpisodes(animes[animeIndex])
      const episodeIdx = eps.findIndex((e) => e.path === progress.episodePath)
      if (episodeIdx === -1) continue
      return { animeIndex, episodeIndex: episodeIdx, episode: eps[episodeIdx], anime: animes[animeIndex], progress }
    }
    return null
  }, [watchProgress, animes])

  function resumeContinueWatching(): void {
    if (!continueEntry) return
    setGridIndex(continueEntry.animeIndex)
    setEpisodeIndex(continueEntry.episodeIndex)
    setPlayingSrc(toMediaUrl(continueEntry.progress.episodePath))
    setView('player')
  }

  const onAction = useCallback(
    (action: NavAction) => {
      if (action === 'help') {
        setHelpOpen(true)
        return
      }
      if (action === 'settings') {
        openSettings()
        return
      }

      if (view === 'library') {
        if (animes.length === 0) {
          if (action === 'confirm') {
            window.api.selectLibraryFolder().then((path) => {
              if (path) {
                setLibraryPath(path)
                loadLibrary()
              }
            })
          }
          return
        }

        if (libraryFocus === 'shelf') {
          if (action === 'down' || action === 'back') setLibraryFocus('grid')
          if (action === 'confirm') resumeContinueWatching()
          return
        }

        if (action === 'right') setGridIndex((i) => Math.min(i + 1, animes.length - 1))
        if (action === 'left') setGridIndex((i) => Math.max(i - 1, 0))
        if (action === 'down') setGridIndex((i) => Math.min(i + GRID_COLUMNS, animes.length - 1))
        if (action === 'up') {
          if (gridIndex < GRID_COLUMNS && continueEntry) {
            setLibraryFocus('shelf')
            return
          }
          setGridIndex((i) => Math.max(i - GRID_COLUMNS, 0))
        }
        if (action === 'confirm') {
          openAnime(gridIndex)
        }
        if (action === 'toggleFavorite' && selectedAnime) {
          window.api.toggleFavorite(selectedAnime.name).then(setFavorites)
        }
        return
      }

      if (view === 'episodes' && selectedAnime) {
        const starts = seasonStartIndices(selectedAnime)
        const currentSeason = seasonIndexForEpisode(selectedAnime, episodeIndex)
        const seasonStart = starts[currentSeason] ?? 0
        const seasonEnd = (starts[currentSeason + 1] ?? episodes.length) - 1

        if (action === 'down') setEpisodeIndex((i) => Math.min(i + 1, seasonEnd))
        if (action === 'up') setEpisodeIndex((i) => Math.max(i - 1, seasonStart))
        if (action === 'left') {
          const target = Math.max(0, currentSeason - 1)
          setEpisodeIndex(starts[target] ?? 0)
        }
        if (action === 'right') {
          const target = Math.min(starts.length - 1, currentSeason + 1)
          setEpisodeIndex(starts[target] ?? 0)
        }
        if (action === 'confirm') playEpisode(episodeIndex)
        if (action === 'back') setView('library')
        return
      }
    },
    [view, animes, selectedAnime, episodes, episodeIndex, libraryFocus, gridIndex, continueEntry]
  )

  useControllerNav({
    onAction,
    controls,
    enabled: view !== 'player' && view !== 'settings' && !helpOpen
  })

  const currentEpisode = episodes[episodeIndex]

  if (view === 'player' && playingSrc && selectedAnime && currentEpisode) {
    return (
      <VideoPlayer
        src={playingSrc}
        episodePath={currentEpisode.path}
        animeName={selectedAnime.name}
        title={metadataByName[selectedAnime.name]?.title ?? selectedAnime.name}
        seasonLabel={currentEpisode.season}
        episodeLabel={currentEpisode.name}
        initialPosition={watchProgress[currentEpisode.path]?.position ?? 0}
        hasNext={episodeIndex < episodes.length - 1}
        onNext={() => playEpisode(episodeIndex + 1)}
        onBack={() => {
          refreshProgress()
          setView('episodes')
        }}
      />
    )
  }

  if (view === 'settings') {
    const missingMetadataCount = animes.filter((a) => metadataByName[a.name] == null).length
    return (
      <>
        <SettingsScreen
          libraryPath={libraryPath}
          libraryError={libraryError}
          controls={controls}
          malClientId={malClientId}
          malClientSecret={malClientSecret}
          scanOnStart={scanOnStart}
          animeCount={animes.length}
          missingMetadataCount={missingMetadataCount}
          refetchingMetadata={refetchingMetadata}
          onControlsChange={setControls}
          onLibraryPathChange={(path) => {
            setLibraryPath(path)
            loadLibrary()
          }}
          onLibraryPathManualChange={setLibraryPathManually}
          onScanOnStartChange={(value) => {
            setScanOnStart(value)
            window.api.setScanOnStart(value)
          }}
          onRescan={loadLibrary}
          onRefetchMetadata={refetchMissingMetadata}
          onOpenHelp={() => setHelpOpen(true)}
          onBack={() => setView(previousView)}
          disabled={helpOpen}
        />
        {helpOpen && <HelpModal controls={controls} onClose={() => setHelpOpen(false)} />}
      </>
    )
  }

  if (view === 'episodes' && selectedAnime) {
    return (
      <>
        <TopBar controls={controls} onOpenSettings={openSettings} onOpenHelp={() => setHelpOpen(true)} />
        <AnimeDetailScreen
          anime={selectedAnime}
          metadata={metadataByName[selectedAnime.name]}
          episodeIndex={episodeIndex}
          isFavorite={favorites.includes(selectedAnime.name)}
          watchProgress={watchProgress}
          onPlayEpisode={playEpisode}
          onSelectSeason={(seasonIndex) => {
            const starts = seasonStartIndices(selectedAnime)
            setEpisodeIndex(starts[seasonIndex] ?? 0)
          }}
        />
        {helpOpen && <HelpModal controls={controls} onClose={() => setHelpOpen(false)} />}
      </>
    )
  }

  return (
    <>
      <TopBar controls={controls} onOpenSettings={openSettings} onOpenHelp={() => setHelpOpen(true)} />
      <div className="library-screen">
        {animes.length === 0 ? (
          <div className="empty-library">
            <div className="empty-library-icon">vacío</div>
            <h1>{libraryError ? 'No se pudo leer la carpeta' : 'No encontré animes aquí'}</h1>
            <p className="empty-library-path">{libraryPath ?? '(ninguna carpeta configurada)'}</p>
            <p className={`empty-library-hint${libraryError ? ' error' : ''}`}>
              {libraryError ??
                'Cada serie debe ser una carpeta, con una subcarpeta por temporada y los episodios dentro.'}
            </p>
            <div className="empty-library-actions">
              <button
                className="empty-library-cta focused"
                onClick={() => {
                  window.api.selectLibraryFolder().then((path) => {
                    if (path) {
                      setLibraryPath(path)
                      loadLibrary()
                    }
                  })
                }}
              >
                Elegir carpeta
              </button>
              {libraryPath && (
                <button
                  className={`library-update-btn${libraryUpdateRunning ? ' running' : ''}`}
                  onClick={runLibraryUpdate}
                  disabled={libraryUpdateRunning}
                >
                  {libraryUpdateRunning ? 'Actualizando...' : 'Actualizar animes'}
                </button>
              )}
            </div>
            {(libraryUpdateRunning || libraryUpdateResult) && (
              <div
                className={`library-update-status${
                  !libraryUpdateRunning && libraryUpdateResult ? (libraryUpdateResult.ok ? ' ok' : ' error') : ''
                }`}
              >
                {libraryUpdateRunning ? (libraryUpdateLine ?? 'Iniciando jkanime-dl...') : libraryUpdateResult?.message}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="library-title-row">
              <h1>Mi Anime</h1>
              <div className="library-count">
                {animes.length} series · {favorites.length} favoritas
              </div>
              <div className="library-rows-hint">{Math.ceil(animes.length / GRID_COLUMNS)} filas</div>
              <button
                className={`library-update-btn${libraryUpdateRunning ? ' running' : ''}`}
                onClick={runLibraryUpdate}
                disabled={libraryUpdateRunning}
              >
                {libraryUpdateRunning ? 'Actualizando...' : 'Actualizar animes'}
              </button>
            </div>
            {(libraryUpdateRunning || libraryUpdateResult) && (
              <div
                className={`library-update-status${
                  !libraryUpdateRunning && libraryUpdateResult ? (libraryUpdateResult.ok ? ' ok' : ' error') : ''
                }`}
              >
                {libraryUpdateRunning ? (libraryUpdateLine ?? 'Iniciando jkanime-dl...') : libraryUpdateResult?.message}
              </div>
            )}
            {continueEntry && (
              <ContinueWatching
                title={metadataByName[continueEntry.anime.name]?.title ?? continueEntry.anime.name}
                coverImage={metadataByName[continueEntry.anime.name]?.coverImage ?? null}
                seasonLabel={continueEntry.episode.season}
                episodeLabel={continueEntry.episode.name}
                position={continueEntry.progress.position}
                duration={continueEntry.progress.duration}
                focused={libraryFocus === 'shelf'}
                onResume={resumeContinueWatching}
              />
            )}
            <LibraryGrid
              animes={animes}
              metadataByName={metadataByName}
              focusedIndex={gridIndex}
              favorites={favorites}
              dimmed={libraryFocus === 'shelf'}
              onSelect={openAnime}
            />
            <ControlsLegend
              items={[
                { key: 'A', label: 'Abrir', tone: 'accent' },
                { key: 'Y', label: 'Favorito', tone: 'amber' }
              ]}
            />
          </>
        )}
      </div>
      {helpOpen && <HelpModal controls={controls} onClose={() => setHelpOpen(false)} />}
    </>
  )
}
