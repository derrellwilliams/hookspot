import Anthropic from 'npm:@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5'
const PROMPT =
  'Is there a fish in this photo? If yes, identify the species as specifically as possible. If no fish is visible, reply with "none". Reply with only the species name or "none" — no other text.'

const MAX_BYTES = 4 * 1024 * 1024

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(null, { status: 405 })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // Verify the caller holds a valid Supabase session
  const verifyRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: {
      apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      Authorization: authHeader,
    },
  })
  if (!verifyRes.ok) return json({ error: 'Unauthorized' }, 401)

  const buf = await req.arrayBuffer()
  if (buf.byteLength > MAX_BYTES) return json({ error: 'Image too large' }, 413)

  const bytes = new Uint8Array(buf)
  const base64Data = uint8ArrayToBase64(bytes)
  const mediaType = (req.headers.get('content-type') ?? 'image/jpeg').split(';')[0]

  try {
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: PROMPT },
        ],
      }],
    })
    const species = response.content[0]?.text?.trim() ?? 'none'
    return json({ species })
  } catch (err) {
    console.error('[identify]', err)
    return json({ error: err.message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}
