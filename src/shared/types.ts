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

export type NavAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'confirm'
  | 'back'
  | 'toggleFavorite'
  | 'settings'
  | 'help'

export const NAV_ACTIONS: NavAction[] = [
  'up',
  'down',
  'left',
  'right',
  'confirm',
  'back',
  'toggleFavorite',
  'settings',
  'help'
]

export const NAV_ACTION_LABELS: Record<NavAction, string> = {
  up: 'Arriba',
  down: 'Abajo',
  left: 'Izquierda',
  right: 'Derecha',
  confirm: 'Confirmar',
  back: 'Volver',
  toggleFavorite: 'Favorito',
  settings: 'Configuración',
  help: 'Ayuda'
}

export interface ControlsConfig {
  keyboard: Record<NavAction, string>
  gamepad: Record<NavAction, number>
}

export const DEFAULT_CONTROLS: ControlsConfig = {
  keyboard: {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    confirm: 'Enter',
    back: 'Escape',
    toggleFavorite: 'f',
    settings: 'F2',
    help: 'F1'
  },
  gamepad: {
    up: 12,
    down: 13,
    left: 14,
    right: 15,
    confirm: 0, // A
    back: 1, // B
    toggleFavorite: 3, // Y
    settings: 9, // Start
    help: 8 // Back / Select
  }
}

export interface Settings {
  libraryPath: string | null
  favorites: string[]
  malClientId: string | null
  malClientSecret: string | null
  controls: ControlsConfig
}
