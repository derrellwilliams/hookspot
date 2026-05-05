import { createCheckUsernameHandler } from '../check-username-handler.js'

const handle = createCheckUsernameHandler(process.env)

export default function handler(req, res) {
  handle(req, res)
}
