// Shared constants for the /identify endpoint.
// Used by vite.config.js (dev), server.js (production), and scripts/identify.js (batch).
export const IDENTIFY_MODEL = 'claude-haiku-4-5'
export const IDENTIFY_PROMPT = 'Is there a fish in this photo? If yes, identify the species as specifically as possible. If no fish is visible, reply with "none". Reply with only the species name or "none" — no other text.'
