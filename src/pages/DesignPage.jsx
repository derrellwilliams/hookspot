import { useState } from 'react'
import { motion } from 'motion/react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Icons from '../components/icons.js'
import { Xmark, EditPencil } from '../components/icons.js'
import { tokens } from '../tokens.js'
import { Avatar, Button, Input, Select, SelectWithCustom } from '../components/ui/index.js'
import { usePhotoStore } from '../store/usePhotoStore.js'
import { PixelFishLoader } from '../components/PixelFishLoader.jsx'
import { SkeletonCard } from '../components/CatchGrid/CatchGrid.jsx'
import { SPRING, SPRING_TIGHT } from '../lib/motion.js'
import styles from './DesignPage.module.css'
import d from '../components/UploadDialog/UploadDialog.module.css'
import s from './SearchPage.module.css'
import p from './UserProfilePage.module.css'
import glass from '../styles/shared.module.css'

function DemoDialog({ open, onClose }) {
  return (
    <Dialog.Root open={open} onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className={d.backdrop} />
        <Dialog.Content className={d.content} aria-describedby={undefined}>
          <div className={d.header}>
            <Dialog.Title className={d.title}>Edit profile</Dialog.Title>
            <Dialog.Close asChild><Button variant="icon-sm" aria-label="Close"><Xmark width={20} height={20} /></Button></Dialog.Close>
          </div>
          <div className={d.body}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input placeholder="Display name" />
              {/* No shared textarea component yet — this is a gap, not a pattern to copy. */}
              <textarea placeholder="Bio" rows={3} style={{ padding: '8px 10px', background: 'var(--dark-surface)', border: '1px solid var(--dark-border)', borderRadius: 8, color: 'var(--dark-text)', fontFamily: 'inherit', resize: 'none' }} />
            </div>
          </div>
          <div className={d.form}>
            <div className={d.actions}>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button variant="primary">Save</Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Section({ label, children }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      {children}
    </div>
  )
}

export function DesignPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [tab, setTab] = useState('profile')
  const [filterTab, setFilterTab] = useState('catches')
  const colorTokens = Object.entries(tokens).filter(([, v]) => String(v).startsWith('#'))

  return (
    <div className={styles.page}>
      <div className={styles.scroll}>
        <div className={styles.header}>
          <span className={styles.title}>Design System</span>
        </div>

        <Section label="Colors">
          <div className={styles.swatchRow}>
            {colorTokens.map(([name, hex]) => (
              <div key={name} className={styles.swatch}>
                <div className={styles.swatchColor} style={{ background: hex }} />
                <code className={styles.swatchName}>{name}</code>
                <code className={styles.swatchHex}>{hex}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section label="Typography">
          {[
            { family: 'Display',   font: tokens.fontDisplay,   combos: [{ weight: 400, size: 36 }, { weight: 400, size: 26 }] },
            { family: 'Condensed', font: tokens.fontCondensed, combos: [{ weight: 500, size: 26 }, { weight: 500, size: 16 }, { weight: 400, size: 12 }] },
            { family: 'Mono',      font: tokens.fontMono,      combos: [{ weight: 600, size: 20 }, { weight: 400, size: 13 }, { weight: 400, size: 11 }] },
            { family: 'Sans',      font: tokens.fontSans,      combos: [{ weight: 600, size: 28 }, { weight: 600, size: 24 }, { weight: 600, size: 22 }, { weight: 600, size: 20 }, { weight: 600, size: 16 }, { weight: 600, size: 14 }, { weight: 600, size: 11 }, { weight: 400, size: 16 }, { weight: 400, size: 14 }] },
          ].map(({ family, font, combos }) => (
            <div key={family} className={styles.typeComboGroup}>
              {combos.map(({ weight, size }) => (
                <div key={`${weight}-${size}`} className={styles.typeComboRow}>
                  <code className={styles.typeComboLabel}>{family} · {weight} · {size}px</code>
                  <span style={{ fontFamily: font, fontWeight: weight, fontSize: size, color: 'var(--dark-text)' }}>
                    Brown Trout
                  </span>
                </div>
              ))}
            </div>
          ))}
        </Section>

        <Section label="Glass surface">
          <div className={styles.glassDemoRow}>
            <div className={`${styles.glassDemoBg} ${glass.glassSurface} ${glass.glassShadow}`} />
          </div>
        </Section>

        <Section label="Buttons">
          <div className={styles.buttonRow}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
          <div className={styles.buttonRow} style={{ marginTop: 12 }}>
            <Button variant="primary" icon={<EditPencil width={18} height={18} />}>Edit profile</Button>
            <Button variant="secondary" icon={<EditPencil width={18} height={18} />}>Edit</Button>
          </div>
          <div className={styles.buttonRow} style={{ marginTop: 12 }}>
            <Button variant="icon"><Xmark width={22} height={22} /></Button>
            <Button variant="icon-sm"><Xmark width={20} height={20} /></Button>
          </div>
        </Section>

        <Section label="Input">
          <div className={styles.inputRow}>
            <Input placeholder="Default input" />
            <Input placeholder="Disabled input" disabled />
          </div>
          <div className={styles.inputRow} style={{ marginTop: 12 }}>
            <div className={d.inputWrap}>
              <Input value="Identifying…" disabled className={d.inputLoading} />
              <PixelFishLoader size={14} className={d.inputSpinner} />
            </div>
          </div>
        </Section>

        <Section label="Select">
          <div className={styles.inputRow}>
            <Select defaultValue="brown-trout">
              <option value="brown-trout">Brown Trout</option>
              <option value="rainbow-trout">Rainbow Trout</option>
              <option value="brook-trout">Brook Trout</option>
            </Select>
            <SelectWithCustom
              value=""
              onChange={() => {}}
              suggestions={['Woolly Bugger', 'Elk Hair Caddis', 'Pheasant Tail']}
              placeholder="Select your fly"
            />
          </div>
        </Section>

        <Section label="Avatar">
          <div className={styles.avatarRow}>
            <Avatar user={{ display_name: 'Derrell Williams' }} size={56} />
            <Avatar user={{ display_name: 'Derrell Williams' }} size={36} />
            <Avatar user={{ display_name: 'Derrell Williams' }} size={20} />
          </div>
        </Section>

        <Section label="Icons">
          <div className={styles.iconGrid}>
            {Object.entries(Icons).map(([name, Icon]) => (
              <div key={name} className={styles.iconCell}>
                <Icon width={20} height={20} />
                <code className={styles.iconLabel}>{name}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section label="Segmented tabs">
          <div className={p.tabBar}>
            {[{ id: 'profile', label: 'Recent Activity' }, { id: 'stats', label: 'Stats' }].map(({ id, label }) => {
              const isActive = tab === id
              return (
                <motion.button
                  key={id}
                  className={`${p.tab} ${isActive ? p.tabActive : ''}`}
                  onClick={() => setTab(id)}
                  whileHover={{ scale: 1.007 }}
                  whileTap={{ scale: 0.975 }}
                  transition={SPRING}
                >
                  {isActive && (
                    <motion.div
                      layoutId="design-tab-highlight"
                      className={p.tabHighlight}
                      initial={false}
                      transition={SPRING_TIGHT}
                    />
                  )}
                  <span className={p.tabLabel}>{label}</span>
                </motion.button>
              )
            })}
          </div>
        </Section>

        <Section label="Filter row">
          {/* Borrows SearchPage's page-owned filterBar classes directly so this can't drift. */}
          <div className={s.filterBar}>
            <Select className={s.filterSelect} value={filterTab} onChange={e => setFilterTab(e.target.value)} aria-label="Show">
              <option value="catches">Catches</option>
              <option value="anglers">Anglers</option>
            </Select>
            <Select className={s.filterSelect} defaultValue="everyone" aria-label="Whose catches">
              <option value="everyone">Everyone</option>
              <option value="me">Just me</option>
            </Select>
          </div>
        </Section>

        <Section label="Skeleton loading">
          <div className={styles.skeletonRow}>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </Section>

        <Section label="Dialog">
          <Button variant="primary" onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <DemoDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
        </Section>

        <Section label="Loading">
          <div className={styles.loaderRow}>
            <div className={styles.loaderCard}>
              <PixelFishLoader size={64} />
              <span className={styles.loaderLabel}>Ambient chase, loops forever</span>
            </div>
            <div className={styles.loaderCard}>
              <PixelFishLoader size={20} />
              <span className={styles.loaderLabel}>@ 20px (inline size)</span>
            </div>
          </div>
        </Section>

        <Section label="Toast">
          <div className={styles.buttonRow}>
            <Button
              variant="secondary"
              onClick={() => usePhotoStore.getState().showToast('Design system!')}
            >
              Demo toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => usePhotoStore.getState().showToast('Saved!', 'success')}
            >
              Demo success chip
            </Button>
          </div>
        </Section>
      </div>
    </div>
  )
}
