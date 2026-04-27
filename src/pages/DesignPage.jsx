import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Xmark, Plus } from 'iconoir-react'
import { tokens } from '../tokens.js'
import { Button, Input, Card, AutocompleteInput, Select, SelectWithCustom, Tooltip } from '../components/ui/index.js'
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
            <Dialog.Title className={d.title}>Dialog title</Dialog.Title>
            <Dialog.Close asChild><Button variant="icon-sm" aria-label="Close"><Xmark width={20} height={20} /></Button></Dialog.Close>
          </div>
          <div className={d.body}>
            Dialog body content goes here.
          </div>
          <div className={d.form}>
            <div className={d.actions}>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button variant="primary">Confirm</Button>
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
            { label: 'fontDisplay (Space Mono)', font: tokens.fontDisplay },
            { label: 'fontSans (Roboto)', font: tokens.fontSans },
            { label: 'fontMono (Roboto Mono)', font: tokens.fontMono },
          ].map(({ label, font }) => (
            <div key={label} className={styles.typeFamilyRow}>
              <div className={styles.typeFamilyLabel}>{label}</div>
              <div className={styles.typeSamples}>
                <span style={{ fontFamily: font, fontSize: 24, fontWeight: 700 }}>Heading</span>
                <span style={{ fontFamily: font, fontSize: 16 }}>Body text sample</span>
                <span style={{ fontFamily: font, fontSize: 12 }}>Small caption text</span>
              </div>
            </div>
          ))}
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
            <Button variant="primary" icon={<Plus width={18} height={18} />}>Add catch</Button>
            <Button variant="secondary" icon={<Plus width={18} height={18} />}>Secondary</Button>
            <Button variant="ghost" icon={<Plus width={18} height={18} />}>Ghost</Button>
          </div>
          <div className={styles.buttonRow} style={{ marginTop: 12 }}>
            <Button variant="icon"><Xmark width={24} height={24} /></Button>
            <Button variant="icon-sm"><Xmark width={20} height={20} /></Button>
          </div>
        </Section>

        <Section label="Input">
          <div className={styles.inputRow}>
            <Input placeholder="Default input" />
            <Input placeholder="Disabled input" disabled />
          </div>
        </Section>

        <Section label="Autocomplete Input">
          <div className={styles.inputRow}>
            <AutocompleteInput
              placeholder="e.g. 9ft 5wt"
              suggestions={['9ft 5wt', '8ft 4wt', '10ft 3wt', '7ft 3wt']}
            />
          </div>
        </Section>

        <Section label="Select">
          <div className={styles.inputRow}>
            <Select defaultValue="">
              <option value="">Select…</option>
              <option value="a">Option A</option>
              <option value="b">Option B</option>
              <option value="c">Option C</option>
            </Select>
          </div>
        </Section>

        <Section label="Select with Custom">
          <div className={styles.inputRow}>
            <SelectWithCustom
              placeholder="e.g. 9ft 5wt"
              suggestions={['9ft 5wt', '8ft 4wt', '10ft 3wt']}
            />
          </div>
        </Section>

        <Section label="Tooltip">
          <div className={styles.buttonRow}>
            <Tooltip label="Tooltip label" side="top">
              <Button variant="secondary">Hover me (top)</Button>
            </Tooltip>
            <Tooltip label="Tooltip label" side="bottom">
              <Button variant="secondary">Hover me (bottom)</Button>
            </Tooltip>
          </div>
        </Section>

        <Section label="Card">
          <Card>
            <div className={styles.cardContent}>
              <strong>Card Title</strong>
              <p>This is example content inside a Card component.</p>
            </div>
          </Card>
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
