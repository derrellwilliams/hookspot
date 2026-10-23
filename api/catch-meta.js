import fs from 'fs'
import path from 'path'
import { buildCatchMeta, parseCatchShareUrl, injectMeta } from '../catch-meta-handler.js'

// vercel.json rewrites shared catch links (`/user/:username?catch=<id>`) here so
// link previews get per-catch OG tags. Every response is the built SPA shell
// (dist/index.html, bundled via `includeFiles`) — with tags injected when the
// catch resolves, untouched otherwise — so the page itself always loads.
let indexHtml = null
function getIndexHtml() {
  indexHtml ??= fs.readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf-8')
  return indexHtml
}

export default async function handler(req, res) {
  let html
  try {
    html = getIndexHtml()
  } catch (err) {
    console.error('[catch-meta] index.html missing:', err.message)
    res.statusCode = 500
    res.end()
    return
  }

  try {
    const url = new URL(req.url, `https://${req.headers.host}`)
    // Depending on how the rewrite surfaces, req.url is either the original
    // share path or the destination with `username` as a query param.
    const parsed = parseCatchShareUrl(url.pathname, url.searchParams) ?? (
      url.searchParams.get('username') && url.searchParams.get('catch')
        ? { username: url.searchParams.get('username'), catchParam: url.searchParams.get('catch') }
        : null
    )
    const meta = parsed && await buildCatchMeta(process.env, parsed.username, parsed.catchParam)
    if (meta) {
      const proto = req.headers['x-forwarded-proto'] || 'https'
      meta.url = `${proto}://${req.headers.host}/user/${encodeURIComponent(parsed.username)}?catch=${encodeURIComponent(parsed.catchParam)}`
      html = injectMeta(html, meta)
    }
  } catch (err) {
    console.error('[catch-meta] error:', err.message)
  }

  res.statusCode = 200
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.end(html)
}
