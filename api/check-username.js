import { createCheckUsernameHandler } from '../check-username-handler.js'

const handle = createCheckUsernameHandler(process.env)

export default function handler(req, res) {
  return handle(req, res)
}
