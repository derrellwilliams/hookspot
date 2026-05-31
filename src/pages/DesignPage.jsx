import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Xmark, EditPencil } from 'iconoir-react'
import { tokens } from '../tokens.js'
import { Button, Input } from '../components/ui/index.js'
import { usePhotoStore } from '../store/usePhotoStore.js'
import styles from './DesignPage.module.css'
import d from '../components/UploadDialog/UploadDialog.module.css'

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
              <input placeholder="Display name" style={{ padding: '8px 10px', background: 'var(--dark-surface)', border: '1px solid var(--dark-border)', borderRadius: 8, color: 'var(--dark-text)' }} />
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
            { family: 'Display',   font: tokens.fontDisplay,   combos: [{ weight: 700, size: 36 }, { weight: 700, size: 26 }] },
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

        <Section label="Buttons">
          <div className={styles.buttonRow}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
          <div className={styles.buttonRow} style={{ marginTop: 12 }}>
            <Button variant="primary" icon={<EditPencil width={18} height={18} />}>Edit profile</Button>
            <Button variant="secondary" icon={<EditPencil width={18} height={18} />}>Edit</Button>
          </div>
          <div className={styles.buttonRow} style={{ marginTop: 12 }}>
            <Button variant="icon-sm"><Xmark width={20} height={20} /></Button>
          </div>
        </Section>

        <Section label="Input">
          <div className={styles.inputRow}>
            <Input placeholder="Default input" />
            <Input placeholder="Disabled input" disabled />
          </div>
        </Section>

        <Section label="Dialog">
          <Button variant="primary" onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <DemoDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
        </Section>

        <Section label="Toast">
          <Button
            variant="secondary"
            onClick={() => usePhotoStore.getState().showToast('Design system!')}
          >
            Demo toast
          </Button>
        </Section>
      </div>
    </div>
  )
}
