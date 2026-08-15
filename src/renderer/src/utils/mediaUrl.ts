// "app-media://file/<encoded absolute path>" rather than a triple-slash
// "app-media:///<path>" — Chromium's URL parser treats registered custom
// schemes as needing an authority (host), so an empty host before an
// absolute path resolves inconsistently (net::ERR_FILE_NOT_FOUND). Using a
// fixed placeholder host plus a single opaque, fully-encoded path segment
// sidesteps that parsing ambiguity entirely.
export function toMediaUrl(absolutePath: string): string {
  return `app-media://file/${encodeURIComponent(absolutePath)}`
}
