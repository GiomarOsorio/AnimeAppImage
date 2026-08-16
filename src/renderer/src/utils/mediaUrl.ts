// Video/subtitle files are served by a loopback-only HTTP server started by the Rust
// backend (see src-tauri/src/media_server.rs) rather than a custom app-media:// scheme —
// WebKitGTK's handling of custom URI schemes + Range requests for <video> seeking is a
// rockier, less-tested path than a plain HTTP server, which the WebView can't tell apart
// from any other video URL.
let mediaPort: number | null = null

export async function initMediaUrl(): Promise<void> {
  mediaPort = await window.api.getMediaPort()
}

export function toMediaUrl(absolutePath: string): string {
  if (mediaPort == null) {
    throw new Error('mediaPort no inicializado — initMediaUrl() debe resolverse antes de reproducir')
  }
  return `http://127.0.0.1:${mediaPort}/${encodeURIComponent(absolutePath)}`
}
