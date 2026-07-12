import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import * as Dialog from '@radix-ui/react-dialog'
import { supabase } from '../../lib/supabase.js'
import { UserRow } from '../UserRow/UserRow.jsx'
import { EASE_OUT, EASE_ENTER } from '../../lib/motion.js'
import styles from './FollowListDialog.module.css'

const spring = { type: 'spring', stiffness: 400, damping: 35 }

export function FollowListDialog({ open, onClose, profileId, initialTab }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(initialTab || 'followers')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [animateTabs, setAnimateTabs] = useState(false)

  // Sync initialTab when dialog re-opens
  useEffect(() => {
    if (open) setActiveTab(initialTab || 'followers')
  }, [open, initialTab])

  // The tab highlight's layoutId animation runs against bounds measured while
  // the dialog is still mounting, so it slides in from a bogus position on
  // open. Keep it instant until the first painted frame, then animate.
  useEffect(() => {
    if (!open) { setAnimateTabs(false); return }
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setAnimateTabs(true)))
    return () => cancelAnimationFrame(raf)
  }, [open])

  useEffect(() => {
    if (!open || !profileId) return
    setLoading(true)
    setList([])
    ;(async () => {
      try {
        let data, error
        if (activeTab === 'followers') {
          // People who follow profileId
          const res = await supabase
            .from('follows')
            .select('profiles!follower_id(id,username,display_name,avatar_url)')
            .eq('following_id', profileId)
          data = res.data; error = res.error
          if (!error && data) setList(data.map(r => r.profiles).filter(Boolean))
        } else {
          // People profileId is following
          const res = await supabase
            .from('follows')
            .select('profiles!following_id(id,username,display_name,avatar_url)')
            .eq('follower_id', profileId)
          data = res.data; error = res.error
          if (!error && data) setList(data.map(r => r.profiles).filter(Boolean))
        }
        if (error) {
          // Fallback: two-query approach if join disambiguation fails
          const idsRes = activeTab === 'followers'
            ? await supabase.from('follows').select('follower_id').eq('following_id', profileId)
            : await supabase.from('follows').select('following_id').eq('follower_id', profileId)
          const ids = (idsRes.data || []).map(r => r.follower_id || r.following_id)
          if (ids.length > 0) {
            const profilesRes = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', ids)
            setList(profilesRes.data || [])
          }
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [open, activeTab, profileId])

  function goToUser(username) {
    onClose()
    navigate(`/user/${username}`)
  }

  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose() }}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  className={styles.backdrop}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div
                  className={styles.panel}
                  style={{ x: '-50%', y: '-50%' }}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15, ease: EASE_OUT } }}
                  transition={{ duration: 0.25, ease: EASE_ENTER }}
                >
                  <Dialog.Title className={styles.srOnly}>Followers and following</Dialog.Title>

                  <div className={styles.header}>
                    <div className={styles.tabBar}>
                      {[{ id: 'followers', label: 'Followers' }, { id: 'following', label: 'Following' }].map(({ id, label }) => {
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
                                layoutId="follow-tab-highlight"
                                className={styles.tabHighlight}
                                initial={false}
                                transition={animateTabs ? spring : { duration: 0 }}
                              />
                            )}
                            <span className={styles.tabLabel}>{label}</span>
                          </motion.button>
                        )
                      })}
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
                  </div>

                  <div className={styles.body}>
                    {loading && <div className={styles.emptyState}>Loading…</div>}
                    {!loading && list.length === 0 && (
                      <div className={styles.emptyState}>
                        {activeTab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                      </div>
                    )}
                    {!loading && list.map(user => (
                      <UserRow key={user.id} user={user} onClick={() => goToUser(user.username)} />
                    ))}
                  </div>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
