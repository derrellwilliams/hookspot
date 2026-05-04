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
