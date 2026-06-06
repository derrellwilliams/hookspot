import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import * as Dialog from '@radix-ui/react-dialog'
import { supabase } from '../../lib/supabase.js'
import styles from './SearchOverlay.module.css'

const spring = { type: 'spring', stiffness: 400, damping: 35 }

function UserRow({ user, onClick }) {
  const initial = (user.display_name || user.username || '?')[0].toUpperCase()
  return (
    <button className={styles.userRow} onClick={onClick}>
      {user.avatar_url
        ? <img src={user.avatar_url} alt={user.display_name || user.username} className={styles.userAvatar} />
        : <div className={styles.userAvatarFallback}>{initial}</div>
      }
      <div className={styles.userInfo}>
        <span className={styles.userDisplayName}>{user.display_name || user.username}</span>
        <span className={styles.userUsername}>@{user.username}</span>
      </div>
    </button>
  )
}

export function SearchOverlay({ open, onClose, profileId }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('following')
  const [list, setList] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) { setQuery(''); setActiveTab('following') }
  }, [open])

  // Fetch follow list when overlay opens or tab changes
  useEffect(() => {
    if (!open || !profileId) return
    setListLoading(true)
    setList([])
    ;(async () => {
      try {
        const col = activeTab === 'followers' ? 'following_id' : 'follower_id'
        const joinCol = activeTab === 'followers' ? 'follower_id' : 'following_id'
        const { data, error } = await supabase
          .from('follows')
          .select(`profiles!${joinCol}(id,username,display_name,avatar_url)`)
          .eq(col, profileId)
        if (!error && data) {
          setList(data.map(r => r.profiles).filter(Boolean))
        } else {
          // Fallback two-query approach
          const idsRes = await supabase.from('follows').select(joinCol).eq(col, profileId)
          const ids = (idsRes.data || []).map(r => r[joinCol])
          if (ids.length > 0) {
            const profilesRes = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', ids)
            setList(profilesRes.data || [])
          }
        }
      } finally {
        setListLoading(false)
      }
    })()
  }, [open, activeTab, profileId])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/search-users?q=${encodeURIComponent(query.trim())}`)
        const { results: data } = await res.json()
        setResults(data || [])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  function goToUser(username) {
    onClose()
    navigate(`/user/${username}`)
  }

  const isSearching = !!query.trim()

  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.backdrop} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
          <Dialog.Title className={styles.srOnly}>Search users</Dialog.Title>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
          <div className={styles.inner}>
            <div className={styles.header}>
              <input
                ref={inputRef}
                className={styles.input}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search anglers…"
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className={styles.body}>
              {isSearching ? (
                <>
                  {results.map(user => (
                    <UserRow key={user.id} user={user} onClick={() => goToUser(user.username)} />
                  ))}
                  {!searchLoading && results.length === 0 && (
                    <div className={styles.emptyState}>No anglers found for "{query}"</div>
                  )}
                </>
              ) : (
                <>
                  <div className={styles.tabBar}>
                    {[{ id: 'following', label: 'Following' }, { id: 'followers', label: 'Followers' }].map(({ id, label }) => {
                      const isActive = activeTab === id
                      return (
                        <motion.button
                          key={id}
                          className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                          onClick={() => setActiveTab(id)}
                          whileHover={{ scale: 1.007 }}
                          whileTap={{ scale: 0.975 }}
                          transition={spring}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="search-tab-highlight"
                              className={styles.tabHighlight}
                              initial={false}
                              transition={spring}
                            />
                          )}
                          <span className={styles.tabLabel}>{label}</span>
                        </motion.button>
                      )
                    })}
                  </div>
                  {listLoading && <div className={styles.emptyState}>Loading…</div>}
                  {!listLoading && list.length === 0 && (
                    <div className={styles.emptyState}>
                      {activeTab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                    </div>
                  )}
                  {!listLoading && list.map(user => (
                    <UserRow key={user.id} user={user} onClick={() => goToUser(user.username)} />
                  ))}
                </>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
