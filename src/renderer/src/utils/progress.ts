import type { WatchProgress } from '../../../shared/types'

export function progressFraction(p: WatchProgress | undefined): number {
  if (!p || !p.duration) return 0
  return Math.min(1, p.position / p.duration)
}

export function isWatched(p: WatchProgress | undefined): boolean {
  return !!p && p.duration > 0 && p.position / p.duration >= 0.9
}

export function isInProgress(p: WatchProgress | undefined): boolean {
  const f = progressFraction(p)
  return f > 0.02 && !isWatched(p)
}
