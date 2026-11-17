# Desktop and mobile web review — 2026-11-16

Scope: React web app, shared HTTP handlers, Vite/Vercel/self-host mounts, SQL policies relevant to web, maintenance scripts, dependencies and web CI. Native iOS and React Native are excluded. No styling, layout, design-token or native-app files were changed. This is a static review with targeted mocked regression tests, not a live penetration test or exhaustive behavioral proof.

## Phases and results

1. **Inventory and trust boundaries:** traced public reads, authenticated writes, service-role handlers, direct Supabase writes and all three server mounts. Read project restrictions before editing. Shared backend code reviewed once for both web layouts.
2. **Security:** reviewed authentication, user-controlled filter syntax, upload ownership/cleanup, share previews, RLS migrations, environment-file handling, CI and dependency audit. npm audit returned zero known vulnerabilities; that is not a guarantee of dependency safety.
3. **Correctness:** traced sign-in/session changes, feed loading, upload/add-photo/delete, edit/reorder, metadata enrichment, searches and profile flows. Inspected supporting image, mapping and maintenance paths. Pure presentation code was left unchanged.
4. **Remediation and verification:** implemented the fixes below, added targeted Node regression checks and wired them into web CI. Production compilation used Vite `build.write=false` because a dev server was active. No browser automation, live-account uploads, live database writes, commits, pushes or deployments were performed.

## Fixed locally

- **High: existing-image deletion on add-photo failure.** `uploadPhotoToGroup` previously continued after a Storage 409 and could remove the existing image on subsequent database failure. It now stops on every upload error.
- **High: untrusted share-preview fallback.** Removed the request-host-based fetch and process cache of fallback HTML. The Vercel function now requires its already-configured bundled HTML shell.
- **Medium: search filter injection/malformed filters.** Both search endpoints quote values before URL encoding and bound query length. Underscores and punctuation remain accepted. SQL wildcard semantics remain supported; this does not provide abuse-rate limiting.
- **Medium: profile payload validation.** Reject malformed JSON, nonobject payloads, nonstring metadata and non-HTTPS/oversized avatar URLs; invalid sessions return 401. This protects the handler, not direct table writes.
- **Medium: stale auth state.** Session refreshes update the stored session; sign-out clears username; stale profile responses cannot restore a different account; avatars are retained only for the same user. Feed responses are discarded when the owner changed.
- **Medium: wrong-owner dialog lookup.** Photo matching now includes owner identity, avoiding collisions between common camera filenames.
- **Medium: edits overwritten during reorder.** Reorder writes now retain the newly edited lead-photo metadata.
- **Medium: catch submission integrity.** Concurrent duplicate submissions are blocked; optional gear-save failures cannot trigger catch cleanup.
- **Medium: background metadata races.** Web enrichment writes are serialized and use the current local metadata. Concurrent writes from separate clients still need a database-level merge/transaction strategy.
- **Medium: maintenance-job outbound fetches.** Thumbnail backfill accepts only the configured catches Storage origin/path, rejects redirects and times out downloads. `sips` uses argument-array execution instead of shell interpolation. The destructive backfill itself was not run.
- **Reliability:** restored self-hosted catch-search route; Vercel adapters return handler promises; identification handles authentication/rate-limit service network failures; malformed share path escapes fail safely; failed image decoding releases object URLs; `.env.*` files are ignored except `.env.example`.

Search quoting follows [PostgREST's reserved-character grammar](https://docs.postgrest.org/en/v13/references/api/url_grammar.html). These tests verify request construction; no live PostgREST integration test was performed.

## Verification

- `node --test tests/web-review.test.js`: 5 passing tests (invalid profile payloads, invalid session, quoted search, identification outage, malformed share path).
- Production Vite compilation with `write: false`: passed, 2,464 modules transformed. Does not verify Vercel packaging or runtime configuration.
- `npm audit --audit-level=high`: zero vulnerabilities.
- `git diff --check`: passed.
- Syntax checks of modified server/script modules: passed.
- Browser interaction and authenticated end-to-end upload testing remain unperformed. Project instructions prohibit browser automation unless explicitly requested; real upload verification must use an account with an existing avatar.

## Highest-priority input / external verification

1. **Public location and time policy (high).** Public endpoints return exact coordinates and timestamps; Storage buckets are public. `hideTime` only affects formatting. Decide whether these are intentionally public or need real access control/coarsening. Changing this silently would change the product's information display and sharing behavior.
2. **Verify deployed database and Storage enforcement (high).** Repository migration 008 tightens photo-to-catch ownership, but the current live policy set was not accessible here. Confirm it is fully applied, plus migration 007's service-only rate-limit RPC. Inspect all permissive policies, Storage MIME/size limits and grants. Migration 006 drops the schema's public profile-read policy assuming another policy exists, and references a dashboard-created function; schema/migrations are not a self-contained reproducible bootstrap. A live schema export is needed before safely reconciling this drift.
3. **Set abuse/spending policy (high).** Identification has a 100-call daily per-user cap, but many accounts can multiply it. Public reads and direct Storage uploads lack repository-defined global quotas. Choose a global AI budget, signup-abuse controls and per-account storage limits; enforce them in the provider/database layer, where direct API access cannot bypass them.
4. **Recovery coverage (medium).** The weekly backup covers public database rows only, excludes auth users and photo objects, and depends on a manually provisioned backup role. Confirm a tested restore and choose Storage/auth backup retention before calling this disaster recovery.
5. **Production validation/release (medium).** Changes are local and uncommitted. Live RLS negative tests, avatar-bearing account upload checks, deployment/package validation and browser regression checks need the corresponding environment/access or explicit browser request. No credentials or other projects were inspected.

Other reviewed limitations: whole-JSON metadata updates and multi-request catch/photo edits are not transactional across clients; filename-based storage keys still reject repeat filenames; feed/follow caps can omit older content; direct profile table writes bypass handler field validation; default signup usernames use email prefixes and may collide or expose those prefixes. Resolving these requires data-model or product choices rather than speculative migrations against an unverified live schema.
