import { homedir } from 'os'
import { join } from 'path'
import Store from 'electron-store'
import type { Settings } from '../shared/types'
import { DEFAULT_CONTROLS } from '../shared/types'

const store = new Store<Settings>({
  defaults: {
    libraryPath: join(homedir(), 'Videos'),
    favorites: [],
    malClientId: null,
    malClientSecret: null,
    controls: DEFAULT_CONTROLS
  }
})

export default store
