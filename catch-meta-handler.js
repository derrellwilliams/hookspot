import { serviceHeaders } from './handler-utils.js'
import { cleanSpecies, formatCatchLocation, formatDateFull, getDisplayName } from './src/lib/formatters.js'

// Shared catch links (`/user/:username?catch=<id>`) are just SPA routes —
// nothing server-rendered exists for them, so link-preview fetchers
// (iMessage, Slack, etc.) got back the generic static index.html with no
// image/description. This builds the per-catch title/description/image an
// injected <head> needs to make those previews show the actual photo.
//
// `catchParam` is `groupShareId()`'s output on the client: the catches.id
// (a uuid) when the group has one, otherwise the lead photo's filename.
// Since a uuid and a filename can't be told apart syntactically, try both
// filters rather than guessing from the string shape.
export async function buildCatchMeta(env, username, catchParam) {
  const headers = serviceHeaders(env)

  const profileRes = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/profiles?select=id,username,display_name,avatar_url&username=eq.${encodeURIComponent(username)}&limit=1`,
    { headers }
  )
  if (!profileRes.ok) return null
  const [profile] = await profileRes.json()
  if (!profile) return null

  const fetchPhotos = async (filter) => {
    const res = await fetch(
      `${env.VITE_SUPABASE_URL}/rest/v1/photos?select=*&user_id=eq.${profile.id}&${filter}`,
      { headers }
    )
    if (!res.ok) return []
    const rows = await res.json()
    return Array.isArray(rows) ? rows : []
  }

  let rows = await fetchPhotos(`catch_id=eq.${encodeURIComponent(catchParam)}`)
  if (!rows.length) rows = await fetchPhotos(`filename=eq.${encodeURIComponent(catchParam)}`)
  if (!rows.length) return null
  // Same lead-photo ordering as groupPhotos() client-side: lowest meta.order,
  // then earliest time — so the OG image matches what the dialog shows first.
  const ORDER_UNSET = 999
  const [photo] = [...rows].sort((a, b) =>
    (a.meta?.order ?? ORDER_UNSET) - (b.meta?.order ?? ORDER_UNSET) ||
    (new Date(a.time ?? 0) - new Date(b.time ?? 0))
  )

  const species = cleanSpecies(photo.species)
  const location = formatCatchLocation(photo.meta)
  const dateStr = photo.time ? formatDateFull(photo.time, photo.meta?.hideTime) : null
  const gear = [photo.meta?.rod, photo.meta?.fly].filter(Boolean).join(' · ')
  const name = getDisplayName(profile)

  return {
    title: `${species || 'A catch'}${name ? ` by ${name}` : ''} · HookSpot`,
    description: [dateStr, location, gear || null].filter(Boolean).join(' · ') || 'Shared from HookSpot',
    image: photo.thumb_url || photo.url || null,
  }
}

// Matches `/user/<username>` paths carrying a `?catch=` param — the only
// case that needs a per-catch preview instead of the generic SPA shell.
export function parseCatchShareUrl(pathname, searchParams) {
  const match = pathname.match(/^\/user\/([^/]+)\/?$/)
  const catchParam = searchParams.get('catch')
  if (!match || !catchParam) return null
  return { username: decodeURIComponent(match[1]), catchParam }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// Replaces the static <title> with a per-catch <title> plus OG/Twitter
// meta tags. `meta.url` should be the exact request URL (protocol + host +
// path + query) so previews link back to the right catch.
export function injectMeta(html, meta) {
  const title = escapeHtml(meta.title)
  const description = escapeHtml(meta.description)
  const tags = [
    '<meta property="og:type" content="article">',
    '<meta property="og:site_name" content="HookSpot">',
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    meta.image ? `<meta property="og:image" content="${escapeHtml(meta.image)}">` : null,
    meta.url ? `<meta property="og:url" content="${escapeHtml(meta.url)}">` : null,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    meta.image ? `<meta name="twitter:image" content="${escapeHtml(meta.image)}">` : null,
  ].filter(Boolean).join('\n    ')

  return html.replace(/<title>.*?<\/title>/, `<title>${title}</title>\n    ${tags}`)
}
