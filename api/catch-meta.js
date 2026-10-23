import fs from 'fs'
import path from 'path'
import { renderCatchShare } from '../catch-meta-handler.js'

// vercel.json rewrites shared catch links (`/user/:username?catch=<id>`) here so
// link previews get per-catch OG tags. Every response is the built SPA shell —
// with tags injected when the catch resolves, untouched otherwise — so the page
// itself always loads.
let indexHtml = null
async function getIndexHtml(origin) {
  if (indexHtml) return indexHtml
  try {
    // Bundled into the function via `includeFiles` in vercel.json
    indexHtml = fs.readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf-8')
  } catch (err) {
    console.error('[catch-meta] bundled index.html missing, fetching it:', err.message)
    const res = await fetch(`${origin}/index.html`)
    if (!res.ok) throw new Error(`index.html fetch failed: ${res.status}`)
    indexHtml = await res.text()
  }
  return indexHtml
}

export default async function handler(req, res) {
  const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`
  let html
  try {
    html = await getIndexHtml(origin)
  } catch (err) {
    console.error('[catch-meta]', err.message)
    res.statusCode = 500
    res.end()
    return
  }

  try {
    const url = new URL(req.url, origin)
    html = await renderCatchShare(process.env, html, { pathname: url.pathname, searchParams: url.searchParams, origin }) ?? html
  } catch (err) {
    console.error('[catch-meta] error:', err.message)
  }

  res.statusCode = 200
  res.setHeader('content-type', 'text/html; charset=utf-8')
  // Unlike the static shell, this runs Supabase lookups — let the CDN cache it
  // per URL (catch edits show up within 5 min), while browsers always revalidate.
  // Each deployment has its own CDN cache, so a deploy never serves stale asset hashes.
  res.setHeader('cache-control', 'public, max-age=0, must-revalidate')
  res.setHeader('cdn-cache-control', 'max-age=300, stale-while-revalidate=86400')
  res.end(html)
}
