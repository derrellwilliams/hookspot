import { createSearchUsersHandler } from '../search-users-handler.js'

const handle = createSearchUsersHandler(process.env)

export default function handler(req, res) {
  return handle(req, res)
}
