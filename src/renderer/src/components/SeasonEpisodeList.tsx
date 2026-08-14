import type { Anime } from '../../../shared/types'

interface Props {
  anime: Anime
  focusedIndex: number
}

interface FlatItem {
  type: 'season'
  label: string
}

function flatten(anime: Anime): (FlatItem | { type: 'episode'; label: string; path: string })[] {
  const items: (FlatItem | { type: 'episode'; label: string; path: string })[] = []
  for (const season of anime.seasons) {
    items.push({ type: 'season', label: season.name })
    for (const ep of season.episodes) {
      items.push({ type: 'episode', label: ep.name, path: ep.path })
    }
  }
  return items
}

export default function SeasonEpisodeList({ anime, focusedIndex }: Props): JSX.Element {
  const items = flatten(anime)

  return (
    <div className="episode-list">
      <h1>{anime.name}</h1>
      {items.map((item, index) =>
        item.type === 'season' ? (
          <div key={`s-${item.label}`} className="season-header">
            {item.label}
          </div>
        ) : (
          <div key={item.path} className={`episode-row${index === focusedIndex ? ' focused' : ''}`}>
            {item.label}
          </div>
        )
      )}
    </div>
  )
}

export function flattenEpisodes(anime: Anime): { label: string; path: string }[] {
  const out: { label: string; path: string }[] = []
  for (const season of anime.seasons) {
    for (const ep of season.episodes) out.push({ label: `${season.name} - ${ep.name}`, path: ep.path })
  }
  return out
}

export { flatten }
