import { createSaveProfileHandler } from '../save-profile-handler.js'

// Disable body parsing so the handler can read the raw stream
export const config = { api: { bodyParser: false } }

const handle = createSaveProfileHandler(process.env)

export default function handler(req, res) {
  handle(req, res)
}
