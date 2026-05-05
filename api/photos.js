import { createPhotosHandler } from '../photos-handler.js'

const handle = createPhotosHandler(process.env)

export default function handler(req, res) {
  handle(req, res)
}
