import { createProfileHandler } from '../profile-handler.js'

const handle = createProfileHandler(process.env)

export default function handler(req, res) {
  return handle(req, res)
}
