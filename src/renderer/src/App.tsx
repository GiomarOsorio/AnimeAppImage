import { useCallback, useEffect, useState } from 'react'
import type { Anime, AnimeMetadata } from '../../shared/types'
import LibraryGrid, { GRID_COLUMNS } from './components/LibraryGrid'
import { flattenEpisodes } from './components/SeasonEpisodeList'
import VideoPlayer from './components/VideoPlayer'
import { useControllerNav, type NavAction } from './hooks/useControllerNav'

type View = 'setup' | 'library' | 'episodes' | 'player'

export default function App(): JSX.Element {
  const [view, setView] = useState<View>('setup')
  const [libraryPath, setLibraryPath] = useState<string | null>(null)
  const [animes, setAnimes] = useState<Anime[]>([])
  const [metadataByName, setMetadataByName] = useState<Record<string, AnimeMetadata | null>>({})
  const [favorites, setFavorites] = useState<string[]>([])

  const [gridIndex, setGridIndex] = useState(0)
  const [episodeIndex, setEpisodeIndex] = useState(0)
  const [playingSrc, setPlayingSrc] = useState<string | null>(null)

  useEffect(() => {
    window.api.getSettings().then((settings) => {
      setFavorites(settings.favorites)
      setLibraryPath(settings.libraryPath)
      if (settings.libraryPath) {
        loadLibrary()
      }
    })
  }, [])

  function loadLibrary(): void {
    window.api.getLibrary().then((data) => {
      setAnimes(data)
      setView('library')
      for (const anime of data) {
        window.api.fetchMetadata(anime.name).then((meta) => {
          setMetadataByName((prev) => ({ ...prev, [anime.name]: meta }))
        })
      }
    })
  }

  async function handleSelectFolder(): Promise<void> {
    const path = await window.api.selectLibraryFolder()
    setLibraryPath(path)
    if (path) loadLibrary()
  }

  const selectedAnime = animes[gridIndex]
  const episodes = selectedAnime ? flattenEpisodes(selectedAnime) : []

  const onAction = useCallback(
    (action: NavAction) => {
      if (view === 'setup') {
        if (action === 'confirm') handleSelectFolder()
        return
      }

      if (view === 'library') {
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
    [view, animes.length, selectedAnime, episodes, episodeIndex]
  )

  useControllerNav({ onAction, enabled: view !== 'player' })

  if (view === 'setup') {
    return (
      <div className="setup-screen">
        <h1>Anime Library</h1>
        <p>Selecciona la carpeta raíz de tu biblioteca (ej. ~/Videos)</p>
        <button className="focused" onClick={handleSelectFolder}>
          Elegir carpeta
        </button>
        {libraryPath && <p className="hint">Carpeta actual: {libraryPath}</p>}
        <p className="hint">Enter / A en el control también funciona</p>
      </div>
    )
  }

  if (view === 'player' && playingSrc) {
    return <VideoPlayer src={playingSrc} onBack={() => setView('episodes')} />
  }

  if (view === 'episodes' && selectedAnime) {
    return (
      <div className="episode-list">
        <h1>{selectedAnime.name}</h1>
        {episodes.map((ep, index) => (
          <div key={ep.path} className={`episode-row${index === episodeIndex ? ' focused' : ''}`}>
            {ep.label}
          </div>
        ))}
        <p className="hint">Esc / B para volver</p>
      </div>
    )
  }

  return (
    <div className="library-screen">
      <h1>Mi Anime</h1>
      <LibraryGrid animes={animes} metadataByName={metadataByName} focusedIndex={gridIndex} favorites={favorites} />
    </div>
  )
}
