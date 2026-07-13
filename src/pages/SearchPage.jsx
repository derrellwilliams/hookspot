import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import * as Dialog from '@radix-ui/react-dialog'
import { Search, NavArrowLeft, NavArrowRight } from '../components/icons.js'
import { useAuthStore } from '../store/useAuthStore.js'
import { usePhotoStore } from '../store/usePhotoStore.js'
import { deletePhotos } from '../lib/fileLoader.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { groupPhotos, mapPhotoRow } from '../lib/groupPhotos.js'
import { Select } from '../components/ui/index.js'
import { DitherMesh } from '../components/DitherMesh.jsx'
import { UserRow } from '../components/UserRow/UserRow.jsx'
import { PopupCarousel } from '../components/Map/PopupCarousel.jsx'
import { formatDateNumeric, formatCatchLocation, cleanSpecies } from '../lib/formatters.js'
import { EASE_OUT, EASE_ENTER, EASE_DRAWER } from '../lib/motion.js'
import styles from './SearchPage.module.css'
import cardStyles from '../components/CatchGrid/CatchGrid.module.css'
import { SkeletonCard } from '../components/CatchGrid/CatchGrid.jsx'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'anglers', label: 'Anglers' },
  { id: 'catches', label: 'Catches' },
]

const PAGE_SIZE = 24

function groupShareId(group) {
  return String(group[0].catchId ?? group[0].name)
}

// Adds id/storagePath (needed by deletePhotos) and isOwn/ownerProfile
// (PopupCarousel edit gating + attribution) on top of the shared row mapping.
function mapRows(rows, profiles, myId) {
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  return rows.map(row => ({
    ...mapPhotoRow(row),
    id: row.id,
    storagePath: row.storage_path ?? null,
    isOwn: row.user_id === myId,
    ownerProfile: profileMap[row.user_id] ?? null,
  }))
}

export function SearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const myUser = useAuthStore(s => s.user)
  const myUsername = useAuthStore(s => s.username)
  const showToast = usePhotoStore(s => s.showToast)
  const isMobile = useIsMobile()

  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [activeTab, setActiveTab] = useState('all')
  const [scope, setScope] = useState('everyone')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [userResults, setUserResults] = useState([])
  const [catchRows, setCatchRows] = useState([])
  const [catchesTruncated, setCatchesTruncated] = useState(false)
  const [usersLoading, setUsersLoading] = useState(false)
  const [catchesLoading, setCatchesLoading] = useState(false)

  const [catchPopupIdx, setCatchPopupIdx] = useState(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [activeIdx, setActiveIdx] = useState(-1)

  const inputRef = useRef(null)
  const sentinelRef = useRef(null)
  const itemRefs = useRef([])
  const lastUrlQ = useRef(searchParams.get('q') ?? '')

  const trimmedQuery = query.trim()
  const hasCatchFilters = !!(trimmedQuery || dateFrom || dateTo)
  const isSearching = hasCatchFilters

  // External URL changes (back/forward navigation) update the input; changes we
  // wrote ourselves are recognized via lastUrlQ and skipped.
  useEffect(() => {
    const urlQ = searchParams.get('q') ?? ''
    if (urlQ !== lastUrlQ.current) {
      lastUrlQ.current = urlQ
      setQuery(urlQ)
    }
  }, [searchParams])

  // Debounced search: users + catches in parallel, aborting stale requests.
  useEffect(() => {
    if (!hasCatchFilters) {
      setUserResults([])
      setCatchRows([])
      setCatchesTruncated(false)
      setUsersLoading(false)
      setCatchesLoading(false)
      if (lastUrlQ.current !== '') {
        lastUrlQ.current = ''
        setSearchParams({}, { replace: true })
      }
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      if (trimmedQuery !== lastUrlQ.current) {
        lastUrlQ.current = trimmedQuery
        setSearchParams(trimmedQuery ? { q: trimmedQuery } : {})
      }
      if (trimmedQuery) {
        setUsersLoading(true)
        fetch(`/api/search-users?q=${encodeURIComponent(trimmedQuery)}`, { signal: controller.signal })
          .then(res => res.json())
          .then(json => { setUserResults(json.results || []); setUsersLoading(false) })
          .catch(err => {
            if (err.name === 'AbortError') return
            console.error('[search] users failed:', err)
            setUserResults([])
            setUsersLoading(false)
          })
      } else {
        setUserResults([])
        setUsersLoading(false)
      }
      setCatchesLoading(true)
      setCatchRows([])
      setCatchesTruncated(false)
      const params = new URLSearchParams()
      if (trimmedQuery) params.set('q', trimmedQuery)
      if (myUser?.id) params.set('userId', myUser.id)
      params.set('mine', String(scope === 'me'))
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      fetch(`/api/search-catches?${params}`, { signal: controller.signal })
        .then(res => res.json())
        .then(json => {
          setCatchRows(mapRows(json.rows || [], json.profiles, myUser?.id))
          setCatchesTruncated(!!json.truncated)
          setCatchesLoading(false)
        })
        .catch(err => {
          if (err.name === 'AbortError') return
          console.error('[search] catches failed:', err)
          setCatchRows([])
          setCatchesTruncated(false)
          setCatchesLoading(false)
        })
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [trimmedQuery, hasCatchFilters, scope, dateFrom, dateTo, myUser?.id, setSearchParams])

  const catchGroups = useMemo(() => groupPhotos(catchRows), [catchRows])
  const visibleCatches = useMemo(() => catchGroups.slice(0, visibleCount), [catchGroups, visibleCount])
  const catchPopupGroup = catchPopupIdx !== null ? (catchGroups[catchPopupIdx] ?? null) : null

  const showAnglers = activeTab !== 'catches' && !!trimmedQuery
  const showCatches = activeTab !== 'anglers' && hasCatchFilters

  // Sections render only when they have something to show
  const anglersVisible = showAnglers && userResults.length > 0
  const catchesVisible = showCatches && (catchesLoading || catchGroups.length > 0)
  const nothingFound = isSearching && !usersLoading && !catchesLoading && !anglersVisible && !catchesVisible

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [catchRows])

  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(n => Math.min(n + PAGE_SIZE, catchGroups.length))
    }, { rootMargin: '200px' })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [catchGroups.length, activeTab, visibleCount])

  // Flattened keyboard-navigable result list: angler rows first, then catch cards.
  const flatItems = useMemo(() => [
    ...(anglersVisible ? userResults.map(u => ({ type: 'user', user: u })) : []),
    ...(catchesVisible ? visibleCatches.map((g, i) => ({ type: 'catch', idx: i })) : []),
  ], [anglersVisible, catchesVisible, userResults, visibleCatches])

  useEffect(() => {
    setActiveIdx(-1)
  }, [flatItems.length, activeTab])

  function goToUser(username) {
    navigate(`/user/${username}`)
  }

  function openCatch(idx) {
    setCatchPopupIdx(idx)
  }

  function activateItem(item) {
    if (item.type === 'user') goToUser(item.user.username)
    else openCatch(item.idx)
  }

  // Page-level keyboard nav over results (dialog handles its own keys)
  useEffect(() => {
    if (catchPopupIdx !== null) return
    function handleKey(e) {
      // The dialog's Escape can reach this listener in the same propagation
      // (Radix flushes the close synchronously, re-attaching this effect
      // mid-event) — never treat keys pressed inside a dialog as page keys.
      if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return
      const tag = e.target.tagName
      const isHeroInput = e.target === inputRef.current
      if ((tag === 'INPUT' && !isHeroInput) || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, flatItems.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => {
          const next = Math.max(i - 1, -1)
          if (next === -1) inputRef.current?.focus()
          return next
        })
      } else if (e.key === 'Enter') {
        if (activeIdx >= 0 && flatItems[activeIdx]) {
          e.preventDefault()
          activateItem(flatItems[activeIdx])
        }
      } else if (e.key === 'Escape') {
        if (query) { setQuery(''); setActiveIdx(-1) }
        else inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [catchPopupIdx, flatItems, activeIdx, query]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeIdx >= 0) itemRefs.current[activeIdx]?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  // Arrow keys page through catches while the dialog is open
  useEffect(() => {
    if (catchPopupIdx === null) return
    function handleKey(e) {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowLeft') setCatchPopupIdx(i => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setCatchPopupIdx(i => Math.min(catchGroups.length - 1, i + 1))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [catchPopupIdx, catchGroups.length])

  async function handleCatchDelete(group) {
    await deletePhotos(group)
    const names = new Set(group.map(p => p.name))
    setCatchRows(rows => rows.filter(p => !names.has(p.name)))
    setCatchPopupIdx(null)
    showToast('Catch deleted')
  }

  return (
    <div className={`${styles.page} ${!isSearching ? styles.pageIdle : ''}`}>
      <div className={styles.inner}>
        <div className={styles.inputWrap}>
          <Search className={styles.inputIcon} width={18} height={18} />
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search anglers, species, flies, rods, locations…"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className={styles.filterBar}>
          <Select className={styles.filterSelect} value={activeTab} onChange={e => setActiveTab(e.target.value)} aria-label="Show">
            {TABS.map(({ id, label }) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </Select>
          {activeTab !== 'anglers' && (
            <>
              <Select className={styles.filterSelect} value={scope} onChange={e => setScope(e.target.value)} aria-label="Whose catches">
                <option value="everyone">Everyone</option>
                <option value="me">Just me</option>
              </Select>
              <label className={styles.dateChip}>
                <span className={styles.dateChipLabel}>From</span>
                <input type="date" className={styles.dateInput} value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} />
              </label>
              <label className={styles.dateChip}>
                <span className={styles.dateChipLabel}>To</span>
                <input type="date" className={styles.dateInput} value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} />
              </label>
            </>
          )}
        </div>

        <div className={styles.body}>
          <div className={styles.resultsPane}>
            {!isSearching ? (
              <div className={styles.emptyState}>
                <DitherMesh className={styles.emptyMesh} aria-hidden="true" />
                <div className={styles.emptyContent}>
                  <div className={styles.idleState}>
                    <div className={styles.idleIcon}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width={64} height={64} aria-hidden="true">
                        <path d="M18 19h-6v-2h6v2ZM4 9h2v2H4v2h2v2H4v2H2V7h2v2Zm8 8h-2v-2h2v2Zm8 0h-2v-2h2v2Zm-10-2H8v-2h2v2Zm12 0h-2V9h2v6ZM8 13H6v-2h2v2Zm9-1h-2v-2h2v2Zm-7-1H8V9h2v2Zm2-2h-2V7h2v2Zm8 0h-2V7h2v2Zm-2-2h-6V5h6v2Z" />
                      </svg>
                    </div>
                    <div className={styles.idleTitle}>Search HookSpot</div>
                    <p className={styles.idleHint}>Find anglers by name, or catches by species, fly, rod, location, or date range.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.results}>
                {anglersVisible && (
                  <section>
                    <div className={styles.sectionLabel}>Anglers</div>
                    <div className={styles.listCard}>
                      {userResults.map((user, i) => (
                        <div key={user.id} ref={el => { itemRefs.current[i] = el }}>
                          <UserRow user={user} active={activeIdx === i} onClick={() => goToUser(user.username)} />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {nothingFound && (
                  <div className={styles.emptyText}>
                    {trimmedQuery ? `No results for “${trimmedQuery}”` : 'No catches found in this date range'}
                  </div>
                )}

                {catchesVisible && (
                  <section>
                    <div className={styles.sectionLabel}>Catches</div>
                    {catchesLoading && catchGroups.length === 0 ? (
                      <div className={styles.catchesGrid}>
                        {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
                      </div>
                    ) : (
                      <div className={styles.catchesGrid}>
                        {visibleCatches.map((group, i) => {
                          const lead = group.find(p => p.species) ?? group[0]
                          const species = cleanSpecies(lead.species)
                          const locationStr = formatCatchLocation(lead.meta)
                          const owner = group[0].ownerProfile
                          const flatIdx = (anglersVisible ? userResults.length : 0) + i
                          const ownerName = owner?.display_name || owner?.username
                          return (
                            <motion.button
                              key={group[0].name}
                              ref={el => { itemRefs.current[flatIdx] = el }}
                              className={`${cardStyles.card} ${activeIdx === flatIdx ? cardStyles.cardActive : ''}`}
                              onClick={() => openCatch(i)}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.25, ease: EASE_OUT, delay: i < 9 ? i * 0.04 : 0 }}
                            >
                              <div className={cardStyles.imageWrap}>
                                <img src={lead.thumbUrl ?? lead.url} alt={species ? `${species} catch` : 'Fishing catch photo'} className={cardStyles.image} loading="lazy" />
                              </div>
                              <div className={cardStyles.meta}>
                                {ownerName && (
                                  <div className={cardStyles.angler}>
                                    {owner?.avatar_url
                                      ? <img src={owner.avatar_url} alt="" className={cardStyles.anglerAvatar} />
                                      : <div className={cardStyles.anglerAvatarFallback}>{ownerName[0].toUpperCase()}</div>
                                    }
                                    <span className={cardStyles.anglerName}>{ownerName}</span>
                                  </div>
                                )}
                                {species && <div className={cardStyles.species}>{species}</div>}
                                {lead.time && <div className={cardStyles.datetime}>{formatDateNumeric(lead.time)}</div>}
                                {locationStr && <div className={cardStyles.location}>{locationStr}</div>}
                              </div>
                            </motion.button>
                          )
                        })}
                        {visibleCount < catchGroups.length && (
                          <div ref={sentinelRef} className={styles.loadSentinel} />
                        )}
                      </div>
                    )}
                    {catchesTruncated && visibleCount >= catchGroups.length && (
                      <div className={styles.emptyText}>Showing the first {catchGroups.length} matches — narrow your search to see more.</div>
                    )}
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog.Root open={!!catchPopupGroup} onOpenChange={o => { if (!o) setCatchPopupIdx(null) }}>
        <Dialog.Portal forceMount>
          <AnimatePresence>
            {catchPopupGroup && (
              <>
                <Dialog.Overlay asChild>
                  <motion.div
                    className={styles.catchDialogBackdrop}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  />
                </Dialog.Overlay>
                <Dialog.Content className={styles.catchDialogPositioner} aria-describedby={undefined}>
                  <Dialog.Title className={styles.srOnly}>Catch details</Dialog.Title>
                  {!isMobile && (
                    <button
                      className={styles.catchNavArrow}
                      onClick={() => setCatchPopupIdx(i => Math.max(0, i - 1))}
                      disabled={catchPopupIdx === 0}
                      aria-label="Previous catch"
                    >
                      <NavArrowLeft width={18} height={18} />
                    </button>
                  )}
                  <motion.div
                    className={styles.catchDialogContent}
                    initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.97, y: 4 }}
                    animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                    exit={isMobile
                      ? { y: '100%', transition: { duration: 0.3, ease: EASE_DRAWER } }
                      : { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.15, ease: EASE_OUT } }}
                    transition={isMobile
                      ? { duration: 0.35, ease: EASE_DRAWER }
                      : { duration: 0.25, ease: EASE_ENTER }}
                  >
                    <PopupCarousel
                      key={catchPopupIdx}
                      showMap={!isMobile}
                      sheet
                      initialGroup={catchPopupGroup}
                      shareUrl={`${window.location.origin}/user/${catchPopupGroup[0].ownerProfile?.username ?? myUsername}?catch=${encodeURIComponent(groupShareId(catchPopupGroup))}`}
                      onClose={() => setCatchPopupIdx(null)}
                      onDelete={handleCatchDelete}
                    />
                  </motion.div>
                  {!isMobile && (
                    <button
                      className={styles.catchNavArrow}
                      onClick={() => setCatchPopupIdx(i => Math.min(catchGroups.length - 1, i + 1))}
                      disabled={catchPopupIdx >= catchGroups.length - 1}
                      aria-label="Next catch"
                    >
                      <NavArrowRight width={18} height={18} />
                    </button>
                  )}
                </Dialog.Content>
              </>
            )}
          </AnimatePresence>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
