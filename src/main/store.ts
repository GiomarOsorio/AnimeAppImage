import Store from 'electron-store'
import type { Settings } from '../shared/types'

const store = new Store<Settings>({
  defaults: {
    libraryPath: null,
    useMetadata: true,
    favorites: []
  }
})

export default store
