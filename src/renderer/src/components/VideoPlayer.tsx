import { useEffect, useRef } from 'react'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import 'video.js/dist/video-js.css'

interface Props {
  src: string
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

export default function VideoPlayer({ src, onBack }: Props): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    if (!videoRef.current) return

    const player = videojs(videoRef.current, {
      autoplay: true,
      controls: true,
      fluid: false,
      fill: true,
      userActions: { hotkeys: true }
    })
    playerRef.current = player

    return () => {
      player.dispose()
      playerRef.current = null
    }
  }, [])

  useEffect(() => {
    playerRef.current?.src({ src, type: mimeTypeFor(src) })
  }, [src])

  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' || e.key === 'Backspace') onBack()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onBack])

  return (
    <div className="video-player-wrap" data-vjs-player>
      <video ref={videoRef} className="video-js vjs-big-play-centered" />
    </div>
  )
}
