import { createPhotosHandler } from '../photos-handler.js'

const handle = createPhotosHandler(process.env)

export default function handler(req, res) {
  return handle(req, res)
}
