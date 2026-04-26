import { tokens } from '../tokens.js'
import { Button, Input, Card } from '../components/ui/index.js'
import { usePhotoStore } from '../store/usePhotoStore.js'
import styles from './DesignPage.module.css'

function Section({ label, children }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      {children}
    </div>
  )
}

export function DesignPage() {
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
        </Section>

        <Section label="Input">
          <div className={styles.inputRow}>
            <Input placeholder="Default input" />
            <Input placeholder="Disabled input" disabled />
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
