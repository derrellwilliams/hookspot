export function serviceHeaders(env, includeContentType = false) {
  const h = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  }
  if (includeContentType) h['Content-Type'] = 'application/json'
  return h
}

export function sendJson(res, data, status = 200) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(data))
}

// Reads the full request body into a Buffer, enforcing a max size.
// Sends a 413 and returns null if the limit is exceeded.
export async function readBody(req, res, maxBytes) {
  const chunks = []
  let totalSize = 0
  try {
    await new Promise((resolve, reject) => {
      req.on('data', c => {
        totalSize += c.length
        if (totalSize > maxBytes) {
          sendJson(res, { error: 'Payload too large' }, 413)
          req.destroy(); reject(new Error('too large')); return
        }
        chunks.push(c)
      })
      req.on('end', resolve)
      req.on('error', reject)
    })
  } catch { return null }
  return Buffer.concat(chunks)
}
