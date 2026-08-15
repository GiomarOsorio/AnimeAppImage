import { formatTime } from '../utils/time'

interface Props {
  title: string
  coverImage: string | null
  seasonLabel: string
  episodeLabel: string
  position: number
  duration: number
  focused: boolean
  onResume: () => void
}

export default function ContinueWatching({
  title,
  coverImage,
  seasonLabel,
  episodeLabel,
  position,
  duration,
  focused,
  onResume
}: Props): JSX.Element {
  const pct = duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0

  return (
    <div className={`continue-watching${focused ? ' focused' : ''}`} onClick={onResume}>
      <div
        className="continue-watching-thumb"
        style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}
      />
      <div className="continue-watching-info">
        <div className="continue-watching-eyebrow">Continuar viendo</div>
        <div className="continue-watching-title">
          {title} · {seasonLabel} · {episodeLabel}
        </div>
        <div className="continue-watching-bar-row">
          <div className="continue-watching-bar">
            <div className="continue-watching-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="continue-watching-time">
            {formatTime(position)} / {formatTime(duration)}
          </div>
        </div>
      </div>
      <div className="continue-watching-cta">
        <span className="continue-watching-cta-key">A</span>
        <span>Reanudar</span>
      </div>
    </div>
  )
}
