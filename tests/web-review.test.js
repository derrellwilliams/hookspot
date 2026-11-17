import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createSaveProfileHandler } from '../save-profile-handler.js'
import { createSearchUsersHandler } from '../search-users-handler.js'
import { createIdentifyHandler } from '../identify-handler.js'
import { parseCatchShareUrl } from '../catch-meta-handler.js'
import { searchPattern } from '../handler-utils.js'

function response() {
  return { statusCode: 200, setHeader() {}, end(body) { this.body = body; this.writableEnded = true } }
}
const env = { VITE_SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-only' }
function request(body) {
  const req = Readable.from([Buffer.from(body)])
  req.method = 'POST'; req.headers = {}
  return req
}

test('profile rejects malformed JSON, nonobjects, metadata objects and data avatars before fetch', async () => {
  const original = globalThis.fetch
  globalThis.fetch = () => { throw new Error('must not reach network') }
  try {
    for (const body of ['{', 'null', '[]', JSON.stringify({ token: 'test', username: 'angler', displayName: { large: 'blob' } }), JSON.stringify({ token: 'test', username: 'angler', avatarUrl: 'data:image/jpeg;base64,AAAA' })]) {
      const res = response()
      await createSaveProfileHandler(env)(request(body), res)
      assert.equal(res.statusCode, 400)
    }
  } finally { globalThis.fetch = original }
})

test('invalid profile token returns 401 without writes', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; return { ok: false, json: async () => ({ message: 'expired' }) } }
  try {
    const res = response()
    await createSaveProfileHandler(env)(request(JSON.stringify({ token: 'expired', username: 'angler' })), res)
    assert.equal(res.statusCode, 401); assert.equal(calls, 1)
  } finally { globalThis.fetch = original }
})

test('punctuation and valid username underscores remain inside quoted search operands', async () => {
  const original = globalThis.fetch
  let url
  globalThis.fetch = async value => { url = new URL(value); return { ok: true, json: async () => [] } }
  try {
    const q = 'angler_1),id.not.is.null,display_name.ilike."x'
    const res = response()
    await createSearchUsersHandler(env)({ method: 'GET', url: '/?q=' + encodeURIComponent(q) }, res)
    assert.equal(res.statusCode, 200)
    assert.equal(url.searchParams.get('or'), `(username.ilike.${searchPattern(q)},display_name.ilike.${searchPattern(q)})`)
    assert.equal(JSON.parse(searchPattern(q)), `%${q}%`)
  } finally { globalThis.fetch = original }
})

test('identify fails closed on auth service outage without calling paid API', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('offline') }
  try {
    const req = request('image'); req.headers.authorization = 'Bearer test'
    const res = response()
    await createIdentifyHandler({}, env)(req, res)
    assert.equal(res.statusCode, 503)
  } finally { globalThis.fetch = original }
})

test('malformed escaped share paths do not throw in dev middleware', () => {
  assert.equal(parseCatchShareUrl('/user/%ZZ', new URLSearchParams('catch=123')), null)
})
