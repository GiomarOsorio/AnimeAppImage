import { protocol } from 'electron'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { Readable } from 'stream'
import { extname } from 'path'

export const MEDIA_PROTOCOL = 'app-media'

const ALLOWED_MEDIA_EXTENSIONS = new Set(['.mp4', '.mkv', '.avi', '.webm', '.mov', '.vtt'])

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.vtt': 'text/vtt'
}

// The renderer loads from http://localhost in dev, and Chromium blocks a
// non-file origin from requesting file:// resources outright. net.fetch on a
// file:// URL gets past that, but it doesn't implement HTTP range semantics
// (no 206/Content-Range even when it does honor the Range header and
// truncate the body) — <video> depends on real 206 responses for seeking
// and often for the very first load, so this streams byte ranges by hand.
// Must be registered before the app is ready.
export function registerMediaProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_PROTOCOL,
      privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true }
    }
  ])
}

function parseRange(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
  if (!match) return null
  const [, startStr, endStr] = match
  let start = startStr ? parseInt(startStr, 10) : 0
  let end = endStr ? parseInt(endStr, 10) : fileSize - 1
  if (Number.isNaN(start)) start = 0
  if (Number.isNaN(end) || end >= fileSize) end = fileSize - 1
  if (start > end || start < 0 || start >= fileSize) return null
  return { start, end }
}

export function registerMediaProtocolHandler(): void {
  protocol.handle(MEDIA_PROTOCOL, async (request) => {
    const filePath = decodeURIComponent(request.url.slice(`${MEDIA_PROTOCOL}://file/`.length))
    const ext = extname(filePath).toLowerCase()
    if (!ALLOWED_MEDIA_EXTENSIONS.has(ext)) {
      return new Response('Forbidden', { status: 403 })
    }

    let fileSize: number
    try {
      fileSize = (await stat(filePath)).size
    } catch {
      return new Response('Not Found', { status: 404 })
    }

    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream'
    const rangeHeader = request.headers.get('range')
    const range = rangeHeader ? parseRange(rangeHeader, fileSize) : null

    if (rangeHeader && !range) {
      return new Response('Range Not Satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` }
      })
    }

    if (!range) {
      const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes'
        }
      })
    }

    const { start, end } = range
    const body = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream
    return new Response(body, {
      status: 206,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes'
      }
    })
  })
}
