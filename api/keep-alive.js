import { createKeepAliveHandler } from '../keep-alive-handler.js'

const handle = createKeepAliveHandler(process.env)

export default function handler(req, res) {
  handle(req, res)
}
