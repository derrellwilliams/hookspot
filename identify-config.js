// Shared constants for the /identify endpoint.
// Used by vite.config.js (dev), server.js (production), and scripts/identify.js (batch).
export const IDENTIFY_MODEL = 'claude-opus-5-5'
export const IDENTIFY_PROMPT = 'Is there a fish in this photo? If yes, identify the species as specifically as possible. If no fish is visible, reply with "none". Reply with only the species name or "none" — no other text.'

// Request body for anthropic.beta.messages.create(). Opus 5.5 always thinks, and
// thinking tokens count toward max_tokens, so leave headroom beyond the short answer.
// Low effort keeps this single-label classification fast and cheap. `fallbacks`
// reroutes to another model server-side if a safety classifier declines the request.
export function buildIdentifyRequest(mediaType, base64Data) {
  return {
    model: IDENTIFY_MODEL,
    max_tokens: 2048,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
        { type: 'text', text: IDENTIFY_PROMPT },
      ],
    }],
  }
}

// The response may lead with a thinking block, so find the text block rather than
// reading content[0]. A refusal or truncated answer counts as no identification.
export function extractSpecies(response) {
  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return 'none'
  const text = response.content.find(b => b.type === 'text')?.text?.trim()
  return text || 'none'
}
