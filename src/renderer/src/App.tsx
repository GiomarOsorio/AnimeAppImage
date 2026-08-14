import { useCallback, useEffect, useState } from 'react'
import type { Anime, AnimeMetadata, ControlsConfig } from '../../shared/types'
import { DEFAULT_CONTROLS, type NavAction } from '../../shared/types'
import LibraryGrid, { GRID_COLUMNS } from './components/LibraryGrid'
import { flattenEpisodes } from './components/SeasonEpisodeList'
import VideoPlayer from './components/VideoPlayer'
import TopBar from './components/TopBar'
import HelpModal from './components/HelpModal'
import SettingsScreen from './components/SettingsScreen'
import { useControllerNav } from './hooks/useControllerNav'

type View = 'library' | 'episodes' | 'player' | 'settings'

export default function App(): JSX.Element {
  const [view, setView] = useState<View>('library')
  const [previousView, setPreviousView] = useState<View>('library')
  const [libraryPath, setLibraryPath] = useState<string | null>(null)
  const [animes, setAnimes] = useState<Anime[]>([])
  const [metadataByName, setMetadataByName] = useState<Record<string, AnimeMetadata | null>>({})
  const [favorites, setFavorites] = useState<string[]>([])
  const [controls, setControls] = useState<ControlsConfig>(DEFAULT_CONTROLS)
  const [malClientId, setMalClientId] = useState<string | null>(null)
  const [malClientSecret, setMalClientSecret] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const [gridIndex, setGridIndex] = useState(0)
  const [episodeIndex, setEpisodeIndex] = useState(0)
  const [playingSrc, setPlayingSrc] = useState<string | null>(null)

  useEffect(() => {
    window.api.getSettings().then((settings) => {
      setFavorites(settings.favorites)
      setLibraryPath(settings.libraryPath)
      setControls(settings.controls)
      setMalClientId(settings.malClientId)
      setMalClientSecret(settings.malClientSecret)
      loadLibrary()
    })
  }, [])

  function loadLibrary(): void {
    window.api.getLibrary().then((data) => {
      setAnimes(data)
      setGridIndex(0)
      for (const anime of data) {
        window.api.fetchMetadata(anime.name).then((meta) => {
          setMetadataByName((prev) => ({ ...prev, [anime.name]: meta }))
        })
      }
    })
  }

  function openSettings(): void {
    setPreviousView(view)
    setView('settings')
  }

  const selectedAnime = animes[gridIndex]
  const episodes = selectedAnime ? flattenEpisodes(selectedAnime) : []

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
        if (animes.length === 0) return
        if (action === 'right') setGridIndex((i) => Math.min(i + 1, animes.length - 1))
        if (action === 'left') setGridIndex((i) => Math.max(i - 1, 0))
        if (action === 'down') setGridIndex((i) => Math.min(i + GRID_COLUMNS, animes.length - 1))
        if (action === 'up') setGridIndex((i) => Math.max(i - GRID_COLUMNS, 0))
        if (action === 'confirm') {
          setEpisodeIndex(0)
          setView('episodes')
        }
        if (action === 'toggleFavorite' && selectedAnime) {
          window.api.toggleFavorite(selectedAnime.name).then(setFavorites)
        }
        return
      }

      if (view === 'episodes') {
        if (action === 'down') setEpisodeIndex((i) => Math.min(i + 1, episodes.length - 1))
        if (action === 'up') setEpisodeIndex((i) => Math.max(i - 1, 0))
        if (action === 'confirm' && episodes[episodeIndex]) {
          setPlayingSrc(`file://${episodes[episodeIndex].path}`)
          setView('player')
        }
        if (action === 'back') setView('library')
        return
      }
    },
    [view, animes, selectedAnime, episodes, episodeIndex]
  )

  useControllerNav({
    onAction,
    controls,
    enabled: view !== 'player' && view !== 'settings' && !helpOpen
  })

  if (view === 'player' && playingSrc) {
    return <VideoPlayer src={playingSrc} onBack={() => setView('episodes')} />
  }

  if (view === 'settings') {
    return (
      <>
        <SettingsScreen
          libraryPath={libraryPath}
          controls={controls}
          malClientId={malClientId}
          malClientSecret={malClientSecret}
          onControlsChange={setControls}
          onLibraryPathChange={(path) => {
            setLibraryPath(path)
            loadLibrary()
          }}
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
        <div className="episode-list">
          <h1>{selectedAnime.name}</h1>
          {episodes.map((ep, index) => (
            <div key={ep.path} className={`episode-row${index === episodeIndex ? ' focused' : ''}`}>
              {ep.label}
            </div>
          ))}
          <p className="hint">Esc / B para volver</p>
        </div>
        {helpOpen && <HelpModal controls={controls} onClose={() => setHelpOpen(false)} />}
      </>
    )
  }

  return (
    <>
      <TopBar controls={controls} onOpenSettings={openSettings} onOpenHelp={() => setHelpOpen(true)} />
      <div className="library-screen">
        <h1>Mi Anime</h1>
        {animes.length === 0 ? (
          <p className="hint">
            No se encontraron animes en {libraryPath ?? 'tu carpeta configurada'}. Ve a Configuración → Videos para
            cambiar la carpeta.
          </p>
        ) : (
          <LibraryGrid
            animes={animes}
            metadataByName={metadataByName}
            focusedIndex={gridIndex}
            favorites={favorites}
          />
        )}
      </div>
      {helpOpen && <HelpModal controls={controls} onClose={() => setHelpOpen(false)} />}
    </>
  )
}
