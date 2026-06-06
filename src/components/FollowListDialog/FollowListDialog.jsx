import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import * as Dialog from '@radix-ui/react-dialog'
import { supabase } from '../../lib/supabase.js'
import styles from './FollowListDialog.module.css'

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

export function FollowListDialog({ open, onClose, profileId, initialTab }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(initialTab || 'followers')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)

  // Sync initialTab when dialog re-opens
  useEffect(() => {
    if (open) setActiveTab(initialTab || 'followers')
  }, [open, initialTab])

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
      <Dialog.Portal>
        <Dialog.Overlay className={styles.backdrop} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined}>
          <Dialog.Title className={styles.srOnly}>Followers and following</Dialog.Title>

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
                      transition={spring}
                    />
                  )}
                  <span className={styles.tabLabel}>{label}</span>
                </motion.button>
              )
            })}
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

          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
