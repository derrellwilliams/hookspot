import Anthropic from '@anthropic-ai/sdk'
import { createIdentifyHandler } from '../identify-handler.js'

// Disable Vercel's automatic body parsing so the handler can stream it manually
export const config = { api: { bodyParser: false } }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const handleIdentify = createIdentifyHandler(anthropic)

export default function handler(req, res) {
  handleIdentify(req, res)
}
