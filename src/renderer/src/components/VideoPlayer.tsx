import { useEffect, useRef, useState } from 'react'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import 'video.js/dist/video-js.css'
import { toMediaUrl } from '../utils/mediaUrl'

interface Props {
  src: string
  episodePath: string
  animeName: string
  title: string
  seasonLabel: string
  episodeLabel: string
  initialPosition: number
  hasNext: boolean
  onNext: () => void
  onBack: () => void
}

function mimeTypeFor(src: string): string {
  const ext = src.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'webm':
      return 'video/webm'
    case 'mkv':
      return 'video/x-matroska'
    default:
      return 'video/mp4'
  }
}

interface PlayerBridge {
  onNext: () => void
  hasNext: boolean
}

// video.js's TS types don't model subclassing well, so the custom control
// buttons below read live state off this bridge attached to the player
// instance instead of being recreated whenever props change.
const Button = videojs.getComponent('Button') as any

class SkipBackButton extends Button {
  constructor(player: Player, options?: Record<string, unknown>) {
    super(player, options)
    this.controlText('Retroceder 10 segundos')
    this.addClass('vjs-skip-back-10')
  }
  handleClick(): void {
    const p = this.player()
    p.currentTime(Math.max(0, p.currentTime() - 10))
  }
}

class SkipForwardButton extends Button {
  constructor(player: Player, options?: Record<string, unknown>) {
    super(player, options)
    this.controlText('Adelantar 10 segundos')
    this.addClass('vjs-skip-forward-10')
  }
  handleClick(): void {
    const p = this.player()
    p.currentTime(Math.min(p.duration() ?? Infinity, p.currentTime() + 10))
  }
}

class NextEpisodeButton extends Button {
  constructor(player: Player, options?: Record<string, unknown>) {
    super(player, options)
    this.controlText('Siguiente episodio')
    this.addClass('vjs-next-episode')
  }
  handleClick(): void {
    const bridge: PlayerBridge | undefined = (this.player() as unknown as { animeBridge?: PlayerBridge })
      .animeBridge
    if (bridge?.hasNext) bridge.onNext()
  }
}

if (!videojs.getComponent('SkipBackButton')) {
  videojs.registerComponent('SkipBackButton', SkipBackButton as any)
  videojs.registerComponent('SkipForwardButton', SkipForwardButton as any)
  videojs.registerComponent('NextEpisodeButton', NextEpisodeButton as any)
}

const SAVE_INTERVAL_MS = 5000

export default function VideoPlayer({
  src,
  episodePath,
  animeName,
  title,
  seasonLabel,
  episodeLabel,
  initialPosition,
  hasNext,
  onNext,
  onBack
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<Player | null>(null)
  const lastSaveRef = useRef(0)
  const nextButtonRef = useRef<{ show: () => void; hide: () => void } | null>(null)
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null)
  const [userActive, setUserActive] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return

    // video.js takes over the DOM node it's given and mutates it directly
    // (including on dispose), which conflicts with React reconciling a
    // ref'd <video> itself — most visibly under StrictMode's dev-only
    // mount/unmount/remount, where the second mount would initialize a
    // player on a node video.js had already detached. Building the <video>
    // imperatively into a container React never touches sidesteps that.
    const videoElement = document.createElement('video')
    videoElement.className = 'video-js vjs-big-play-centered'
    containerRef.current.appendChild(videoElement)

    const player = videojs(videoElement, {
      autoplay: true,
      controls: true,
      fluid: false,
      fill: true,
      userActions: { hotkeys: true }
    })
    playerRef.current = player
    ;(player as unknown as { animeBridge: PlayerBridge }).animeBridge = { onNext, hasNext }

    const controlBar = player.getChild('controlBar')
    controlBar?.addChild('SkipBackButton', {}, 1)
    controlBar?.addChild('SkipForwardButton', {}, 2)
    const nextButton = controlBar?.addChild('NextEpisodeButton', {})
    nextButtonRef.current = (nextButton as unknown as { show: () => void; hide: () => void }) ?? null
    if (nextButtonRef.current && !hasNext) nextButtonRef.current.hide()

    function saveProgress(): void {
      const p = playerRef.current
      if (!p) return
      const duration = p.duration()
      const currentTime = p.currentTime()
      if (!duration || Number.isNaN(duration) || currentTime == null) return
      window.api.setWatchProgress(episodePath, animeName, currentTime, duration)
    }

    function handleTimeUpdate(): void {
      const now = Date.now()
      if (now - lastSaveRef.current < SAVE_INTERVAL_MS) return
      lastSaveRef.current = now
      saveProgress()
    }

    player.on('timeupdate', handleTimeUpdate)
    player.on('useractive', () => setUserActive(true))
    player.on('userinactive', () => setUserActive(false))

    return () => {
      saveProgress()
      if (!player.isDisposed()) player.dispose()
      playerRef.current = null
    }
  }, [])

  useEffect(() => {
    const bridge = (playerRef.current as unknown as { animeBridge?: PlayerBridge } | null)?.animeBridge
    if (bridge) {
      bridge.onNext = onNext
      bridge.hasNext = hasNext
    }
    if (hasNext) nextButtonRef.current?.show()
    else nextButtonRef.current?.hide()
  }, [onNext, hasNext])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    player.src({ src, type: mimeTypeFor(src) })
    player.one('loadedmetadata', () => {
      const duration = player.duration()
      if (initialPosition > 5 && duration && initialPosition < duration - 5) {
        player.currentTime(initialPosition)
      }
    })
  }, [src, initialPosition])

  useEffect(() => {
    setSubtitleUrl(null)
    window.api.findSubtitle(episodePath).then(setSubtitleUrl)
  }, [episodePath])

  useEffect(() => {
    const player = playerRef.current as unknown as {
      remoteTextTracks?: () => { length: number; [index: number]: unknown }
      removeRemoteTextTrack?: (track: unknown) => void
      addRemoteTextTrack?: (options: Record<string, unknown>, manualCleanup: boolean) => void
    } | null
    if (!player?.remoteTextTracks) return
    const existing = player.remoteTextTracks()
    for (let i = existing.length - 1; i >= 0; i--) {
      player.removeRemoteTextTrack?.(existing[i])
    }
    if (subtitleUrl) {
      player.addRemoteTextTrack?.(
        { kind: 'subtitles', src: toMediaUrl(subtitleUrl), srclang: 'es', label: 'Español', default: true },
        false
      )
    }
  }, [subtitleUrl])

  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      playerRef.current?.reportUserActivity(undefined)
      if (e.key === 'Escape' || e.key === 'Backspace') onBack()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onBack])

  useEffect(() => {
    // video.js only tracks mouse activity for its own show/hide timer; a
    // gamepad button press doesn't dispatch DOM events at all, so it'd never
    // count as "activity" without polling for it here explicitly.
    let rafId: number
    function poll(): void {
      const pads = navigator.getGamepads ? navigator.getGamepads() : []
      for (const pad of pads) {
        if (!pad) continue
        const stickActive = Math.abs(pad.axes[0] ?? 0) > 0.5 || Math.abs(pad.axes[1] ?? 0) > 0.5
        if (stickActive || pad.buttons.some((b) => b.pressed)) {
          playerRef.current?.reportUserActivity(undefined)
          break
        }
      }
      rafId = requestAnimationFrame(poll)
    }
    rafId = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div className="video-player-wrap">
      <div ref={containerRef} className="video-player-container" />
      <div className={`video-overlay-top${userActive ? '' : ' video-overlay-idle'}`}>
        <div>
          <div className="video-overlay-season">{seasonLabel}</div>
          <div className="video-overlay-episode">{episodeLabel}</div>
          <div className="video-overlay-title">{title}</div>
        </div>
        <button className="video-overlay-exit" onClick={onBack}>
          <span className="video-overlay-exit-key">B</span>
          <span>Salir · Esc</span>
        </button>
      </div>
    </div>
  )
}
