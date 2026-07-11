import { createSearchCatchesHandler } from '../search-catches-handler.js'

const handle = createSearchCatchesHandler(process.env)

export default function handler(req, res) {
  handle(req, res)
}
